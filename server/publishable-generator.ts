import {
  createSessionContext,
  formatSessionTimestamp,
  generateFlowSummarySvg,
  generateGammaExposureSvg,
  generateIVTermStructureSvg,
  generatePutCallOILadderSvg,
  generateVolatilitySmileSvg,
} from './chart-generator';
import {
  fetchPolygonOptionsChain,
  fetchPolygonQuote,
  getIVSmileData,
  getIVTermStructure,
  OptionsChainData,
} from './live-data-service';
import { buildNormalizedSmilePoints } from './iv-utils';
import { formatDollarAmount, runValidationGate, ValidationGateResult } from './post-validator';
import type { ProvenanceEntry, RunArtifacts, SnapshotInfo } from './run-artifacts';

interface GenerateContext {
  runId: string;
  snapshotter?: (name: string, payload: unknown) => Promise<SnapshotInfo> | SnapshotInfo;
  rawPayloads: Record<string, SnapshotInfo>;
}

interface PublishablePostResult {
  post: {
    symbol: string;
    postType: 'OPTIONS_SWEEP' | 'DARK_POOL_PRINT';
    thread: string[];
    charts: Record<string, string>;
    standaloneTweet?: string;
    validation: ValidationGateResult;
  };
  sourcesUsed: Record<string, boolean>;
  usedFallback: boolean;
  missingFields: string[];
  provenance: Record<string, ProvenanceEntry>;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function addProvenance(map: Record<string, ProvenanceEntry>, key: string, entry: ProvenanceEntry) {
  map[key] = entry;
}

export async function generatePublishablePost(
  item: { type: string; data: any },
  context: GenerateContext
): Promise<PublishablePostResult> {
  const session = createSessionContext();
  const eventData = item.data;
  const ticker = eventData.ticker;
  const postType = item.type === 'options' ? 'OPTIONS_SWEEP' : 'DARK_POOL_PRINT';
  const missingFields: string[] = [];
  const provenance: Record<string, ProvenanceEntry> = {};
  const sourcesUsed: Record<string, boolean> = {
    unusual_whales: true,
    polygon: false,
    fmp: false,
    alpha_vantage: false,
    sec_edgar: false,
  };

  const polygonQuote = await fetchPolygonQuote(ticker, context.snapshotter);
  const optionsChain = await fetchPolygonOptionsChain(ticker, context.snapshotter);
  sourcesUsed.polygon = !!(polygonQuote || optionsChain);

  if (!optionsChain) {
    missingFields.push('OPTIONS_CHAIN');
  }

  if (!polygonQuote) {
    missingFields.push('POLYGON_QUOTE');
  }

  const eventSpot = polygonQuote?.price || eventData.price || eventData.strike;
  if (!eventSpot) {
    missingFields.push('SPOT_PRICE');
  }

  const quotePayload = context.rawPayloads[`polygon_quote_${ticker}`];
  if (quotePayload) {
    addProvenance(provenance, 'polygonQuote', {
      source: 'polygon',
      payloadPath: quotePayload.path,
      payloadHash: quotePayload.sha256,
    });
  }

  const chainPayload = context.rawPayloads[`polygon_options_chain_${ticker}`];
  if (chainPayload) {
    addProvenance(provenance, 'optionsChain', {
      source: 'polygon',
      payloadPath: chainPayload.path,
      payloadHash: chainPayload.sha256,
    });
  }

  const sessionTimestamp = formatSessionTimestamp(session.asOfTime, 'short');

  const charts: Record<string, string> = {};
  const requiredCharts: Array<{ key: string; alias?: string }> = [];

  let smileExpiry: string | undefined;
  let smileStrikes: number[] = [];
  let gammaStrikes: number[] = [];
  let oiStrikes: number[] = [];
  let skewDirection: 'call' | 'put' = 'call';

  if (optionsChain && eventSpot) {
    const normalizedSmile = buildSmileData(optionsChain, eventData.expiry, eventSpot, missingFields);
    if (normalizedSmile) {
      smileExpiry = normalizedSmile.expiry;
      smileStrikes = normalizedSmile.strikes;
      charts.volatilitySmileSvg = generateVolatilitySmileSvg({
        ticker,
        expiry: normalizedSmile.expiry,
        strikes: normalizedSmile.strikes,
        currentIV: normalizedSmile.currentIV,
        priorIV: undefined,
        spotPrice: eventSpot,
        anomalyStrikes: [],
        asOfTimestamp: sessionTimestamp,
      });
      requiredCharts.push({ key: 'volatilitySmileSvg' });

      const avgCall = average(normalizedSmile.callIVs);
      const avgPut = average(normalizedSmile.putIVs);
      skewDirection = avgPut > avgCall ? 'put' : 'call';

      addProvenance(provenance, 'volatilitySmile', {
        source: 'polygon',
        payloadPath: chainPayload?.path,
        payloadHash: chainPayload?.sha256,
        derivedFrom: ['optionsChain'],
      });
    }

    const gammaData = buildGammaData(optionsChain, eventSpot, missingFields);
    if (gammaData) {
      gammaStrikes = gammaData.strikes;
      charts.gammaExposureSvg = generateGammaExposureSvg({
        ...gammaData,
        asOfTimestamp: sessionTimestamp,
      });
      requiredCharts.push({ key: 'gammaExposureSvg' });
      addProvenance(provenance, 'gammaExposure', {
        source: 'polygon',
        payloadPath: chainPayload?.path,
        payloadHash: chainPayload?.sha256,
        derivedFrom: ['optionsChain'],
      });
    }

    const oiData = buildOiData(optionsChain, eventSpot, sessionTimestamp, missingFields);
    if (oiData) {
      oiStrikes = oiData.strikes;
      charts.putCallOILadderSvg = generatePutCallOILadderSvg(oiData);
      requiredCharts.push({ key: 'putCallOILadderSvg' });
      addProvenance(provenance, 'putCallOILadder', {
        source: 'polygon',
        payloadPath: chainPayload?.path,
        payloadHash: chainPayload?.sha256,
        derivedFrom: ['optionsChain'],
      });
    }

    const termStructure = getIVTermStructure(optionsChain);
    if (termStructure.length > 0) {
      charts.ivTermStructureSvg = generateIVTermStructureSvg({
        ticker,
        expiries: termStructure.map((d) => {
          const date = new Date(d.expiry);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        ivValues: termStructure.map((d) => d.iv * 100),
        ivChanges24h: termStructure.map(() => 0),
        ivPercentiles: termStructure.map(() => 50),
        asOfTimestamp: sessionTimestamp,
      });
      requiredCharts.push({ key: 'ivTermStructureSvg' });
      addProvenance(provenance, 'ivTermStructure', {
        source: 'polygon',
        payloadPath: chainPayload?.path,
        payloadHash: chainPayload?.sha256,
        derivedFrom: ['optionsChain'],
      });
    } else {
      missingFields.push('IV_TERM_STRUCTURE');
    }
  }

  const flowSummarySvg = generateFlowSummarySvg({
    ticker,
    timestamp: session.asOfTime.toISOString(),
    eventType: postType === 'OPTIONS_SWEEP' ? 'options_sweep' : 'dark_pool',
    size: eventData.contracts || eventData.size || 0,
    sizeUsd: eventData.premium || eventData.value || 0,
    price: postType === 'DARK_POOL_PRINT' ? eventData.price : undefined,
    strike: postType === 'OPTIONS_SWEEP' ? eventData.strike : undefined,
    expiry: postType === 'OPTIONS_SWEEP' ? eventData.expiry : undefined,
    optionType: postType === 'OPTIONS_SWEEP' ? (eventData.type || 'call').toLowerCase() : undefined,
    premium: postType === 'OPTIONS_SWEEP' ? eventData.premium : undefined,
    delta: postType === 'OPTIONS_SWEEP' ? eventData.delta : undefined,
    breakeven: undefined,
    sentiment: eventData.sentiment || 'neutral',
    conviction: 'medium',
    venue: postType === 'DARK_POOL_PRINT' ? eventData.venue || 'DARK' : undefined,
  });
  charts.flowSummarySvg = flowSummarySvg;
  requiredCharts.push({ key: 'flowSummarySvg' });

  addProvenance(provenance, 'unusualWhalesEvent', {
    source: 'unusual_whales',
    payloadPath: context.rawPayloads.unusual_whales_dark_pool?.path || context.rawPayloads.unusual_whales_options?.path,
    payloadHash: context.rawPayloads.unusual_whales_dark_pool?.sha256 || context.rawPayloads.unusual_whales_options?.sha256,
  });

  addProvenance(provenance, 'flowSummary', {
    source: 'unusual_whales',
    payloadPath: context.rawPayloads.unusual_whales_dark_pool?.path || context.rawPayloads.unusual_whales_options?.path,
    payloadHash: context.rawPayloads.unusual_whales_dark_pool?.sha256 || context.rawPayloads.unusual_whales_options?.sha256,
    derivedFrom: ['unusualWhalesEvent'],
  });

  const thread = buildThread({
    eventData,
    postType,
    eventSpot,
    skewDirection,
    smileStrikes,
    gammaStrikes,
    oiStrikes,
  });

  const validation = runValidationGate(
    ticker,
    postType,
    {
      size: eventData.size || eventData.contracts || 0,
      contracts: postType === 'OPTIONS_SWEEP' ? eventData.contracts || 0 : undefined,
      shares: postType === 'DARK_POOL_PRINT' ? eventData.size || 0 : undefined,
      strike: postType === 'OPTIONS_SWEEP' ? eventData.strike || undefined : undefined,
      expiry: postType === 'OPTIONS_SWEEP' ? eventData.expiry || undefined : undefined,
      breakeven: undefined,
      timestamp: session.asOfTime.toISOString(),
      percentile: 50,
      sentimentLabel: eventData.sentiment || 'neutral',
      price: eventSpot || 0,
      notionalValue: eventData.value || eventData.premium || 0,
    },
    thread,
    charts,
    skewDirection,
    gammaStrikes,
    eventSpot || 0,
    smileStrikes,
    oiStrikes,
    { volatilitySmile: smileExpiry } as Record<string, string>,
    undefined,
    {},
    requiredCharts
  );

  return {
    post: {
      symbol: ticker,
      postType,
      thread,
      charts,
      standaloneTweet: buildStandaloneTweet(eventData, postType),
      validation,
    },
    sourcesUsed,
    usedFallback: false,
    missingFields,
    provenance,
  };
}

function buildSmileData(
  chain: OptionsChainData,
  expiry: string | undefined,
  spotPrice: number,
  missingFields: string[]
) {
  const targetExpiry = expiry || chain.expiries[0];
  if (!targetExpiry) {
    missingFields.push('VOLATILITY_SMILE');
    return null;
  }

  const smileData = getIVSmileData(chain, targetExpiry);
  if (smileData.length === 0) {
    missingFields.push('VOLATILITY_SMILE');
    return null;
  }

  const normalized = buildNormalizedSmilePoints(
    smileData.map((d) => ({ strike: d.strike, callIV: d.callIV, putIV: d.putIV })),
    5
  );

  if (normalized.length === 0) {
    missingFields.push('VOLATILITY_SMILE');
    return null;
  }

  const callIVs = smileData.map((d) => d.callIV || 0).filter((v) => v > 0);
  const putIVs = smileData.map((d) => d.putIV || 0).filter((v) => v > 0);

  return {
    expiry: targetExpiry,
    strikes: normalized.map((d) => d.strike),
    currentIV: normalized.map((d) => d.iv),
    callIVs,
    putIVs,
    spotPrice,
  };
}

function buildGammaData(chain: OptionsChainData, spotPrice: number, missingFields: string[]) {
  const sortedStrikes = chain.strikes.slice().sort((a, b) => a - b);
  const nearATMStrikes = sortedStrikes.filter((s) => Math.abs(s - spotPrice) / spotPrice < 0.15).slice(0, 20);
  if (nearATMStrikes.length < 5) {
    missingFields.push('GAMMA_EXPOSURE');
    return null;
  }

  const netGamma = nearATMStrikes.map((s) => chain.gammaByStrike[s] || 0);
  const totalGammaExposure = netGamma.reduce((a, b) => a + b, 0);

  const gammaFlips: { strike: number; percentile: number }[] = [];
  for (let i = 1; i < netGamma.length; i++) {
    if ((netGamma[i - 1] > 0 && netGamma[i] < 0) || (netGamma[i - 1] < 0 && netGamma[i] > 0)) {
      gammaFlips.push({ strike: nearATMStrikes[i], percentile: 75 });
    }
  }

  return {
    ticker: chain.ticker,
    strikes: nearATMStrikes,
    netGamma,
    spotPrice,
    totalGammaExposure,
    gammaFlips,
  };
}

function buildOiData(
  chain: OptionsChainData,
  spotPrice: number,
  asOfTimestamp: string,
  missingFields: string[]
) {
  const sortedStrikes = chain.strikes.slice().sort((a, b) => a - b);
  const nearATMStrikes = sortedStrikes.filter((s) => Math.abs(s - spotPrice) / spotPrice < 0.2).slice(0, 15);
  if (nearATMStrikes.length < 5) {
    missingFields.push('OI_LADDER');
    return null;
  }

  const callOI = nearATMStrikes.map((s) => chain.callOIByStrike[s] || 0);
  const putOI = nearATMStrikes.map((s) => chain.putOIByStrike[s] || 0);
  const totalCallOI = callOI.reduce((a, b) => a + b, 0);
  const totalPutOI = putOI.reduce((a, b) => a + b, 0);

  return {
    ticker: chain.ticker,
    strikes: nearATMStrikes,
    callOI,
    putOI,
    callOIChange: callOI.map((oi) => oi * 0.1),
    putOIChange: putOI.map((oi) => oi * 0.1),
    spotPrice,
    putCallRatio: totalCallOI > 0 && totalPutOI > 0 ? totalPutOI / totalCallOI : null,
    asOfTimestamp,
  };
}

function buildThread(args: {
  eventData: any;
  postType: 'OPTIONS_SWEEP' | 'DARK_POOL_PRINT';
  eventSpot?: number;
  skewDirection: 'call' | 'put';
  smileStrikes: number[];
  gammaStrikes: number[];
  oiStrikes: number[];
}) {
  const { eventData, postType, eventSpot, skewDirection, smileStrikes, gammaStrikes, oiStrikes } = args;
  const size = postType === 'OPTIONS_SWEEP' ? eventData.contracts || 0 : eventData.size || 0;
  const notional = eventData.premium || eventData.value || 0;
  const eventLabel = postType === 'OPTIONS_SWEEP' ? 'options sweep' : 'dark pool print';
  const strikeInfo = postType === 'OPTIONS_SWEEP' ? `Strike $${eventData.strike}, expiry ${eventData.expiry}` : 'Dark pool execution';

  const thread: string[] = [];
  thread.push(
    `1/4 $${eventData.ticker} ${eventLabel} detected. ${formatDollarAmount(notional)} notional across ${size} ${postType === 'OPTIONS_SWEEP' ? 'contracts' : 'shares'}. ${strikeInfo}.`
  );

  if (smileStrikes.length > 0) {
    thread.push(
      `2/4 Options chain context: ${smileStrikes.length} strikes available around $${eventSpot?.toFixed(2)}. ${skewDirection}-side skew leads in IV based on Polygon options snapshot.`
    );
  }

  if (gammaStrikes.length > 0) {
    thread.push(
      `3/4 Gamma exposure mapped from ${gammaStrikes.length} near-the-money strikes. Use this to watch pin/acceleration risk around $${eventSpot?.toFixed(2)}.`
    );
  }

  if (oiStrikes.length > 0) {
    thread.push(
      `4/4 Open interest ladder uses ${oiStrikes.length} strikes to highlight where positioning clusters. Monitor follow-through around key strikes.`
    );
  }

  return thread;
}

function buildStandaloneTweet(eventData: any, postType: 'OPTIONS_SWEEP' | 'DARK_POOL_PRINT') {
  const notional = eventData.premium || eventData.value || 0;
  const size = postType === 'OPTIONS_SWEEP' ? eventData.contracts || 0 : eventData.size || 0;
  const label = postType === 'OPTIONS_SWEEP' ? 'options sweep' : 'dark pool print';
  return `${label.toUpperCase()}: $${eventData.ticker} ${formatDollarAmount(notional)} notional, ${size} ${postType === 'OPTIONS_SWEEP' ? 'contracts' : 'shares'}. Source: Unusual Whales.`;
}

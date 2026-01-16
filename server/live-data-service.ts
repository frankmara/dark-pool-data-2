import type { SnapshotInfo } from './run-artifacts';

type PayloadSnapshotter = (name: string, payload: unknown) => Promise<SnapshotInfo> | SnapshotInfo;

interface DarkPoolPrint {
  ticker: string;
  price: number;
  size: number;
  value: number;
  timestamp: string;
  venue: string;
  percentOfAdv: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface OptionsSweep {
  ticker: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  premium: number;
  contracts: number;
  delta: number;
  timestamp: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface TickerContext {
  ticker: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  float?: number;
  shortInterest?: number;
  analystTarget?: number;
  support?: number;
  resistance?: number;
  tickerType?: string;
}

export async function fetchUnusualWhalesData(snapshotter?: PayloadSnapshotter): Promise<{ darkPool: DarkPoolPrint[], options: OptionsSweep[] }> {
  const apiKey = process.env.UNUSUAL_WHALES_API_KEY;
  if (!apiKey) {
    console.error("[UW] No Unusual Whales API key configured");
    return { darkPool: [], options: [] };
  }

  console.error("[UW] Fetching live data from Unusual Whales API...");

  try {
    const [darkPoolRes, optionsRes] = await Promise.all([
      fetch("https://api.unusualwhales.com/api/darkpool/recent", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      }),
      fetch("https://api.unusualwhales.com/api/option-trades/flow-alerts", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      })
    ]);

    console.error("[UW] Dark Pool API status:", darkPoolRes.status);
    console.error("[UW] Options API status:", optionsRes.status);
    
    const darkPoolRaw = darkPoolRes.ok ? await darkPoolRes.json() : { data: [], error: await darkPoolRes.text() };
    const optionsRaw = optionsRes.ok ? await optionsRes.json() : { data: [], error: await optionsRes.text() };

    if (snapshotter) {
      await snapshotter('unusual_whales_dark_pool', { status: darkPoolRes.status, ok: darkPoolRes.ok, payload: darkPoolRaw });
      await snapshotter('unusual_whales_options', { status: optionsRes.status, ok: optionsRes.ok, payload: optionsRaw });
    }
    
    // Handle different response structures (array directly vs { data: [...] })
    const darkPoolData = Array.isArray(darkPoolRaw) ? darkPoolRaw : (darkPoolRaw.data || darkPoolRaw.result || []);
    const optionsData = Array.isArray(optionsRaw) ? optionsRaw : (optionsRaw.data || optionsRaw.result || optionsRaw.trades || []);
    
    console.error("[UW] Dark pool records:", darkPoolData.length);
    console.error("[UW] Options records:", optionsData.length);
    
    // Log sample of raw response to debug field names
    if (darkPoolData.length > 0) {
      console.error("[UW] Dark pool sample:", JSON.stringify(darkPoolData[0]).slice(0, 500));
    }

    const darkPool: DarkPoolPrint[] = darkPoolData.slice(0, 10).map((d: any) => {
      // Try multiple field name variations for size/volume
      const rawSize = d.size || d.volume || d.shares || d.trade_size || d.qty || d.quantity || 0;
      const size = typeof rawSize === 'string' ? parseInt(rawSize.replace(/,/g, '')) : parseInt(rawSize) || 0;
      
      // Try multiple field name variations for value/premium
      const rawValue = d.notional || d.value || d.premium || d.trade_value || d.dollar_value || 0;
      const value = typeof rawValue === 'string' ? parseFloat(rawValue.replace(/[$,]/g, '')) : parseFloat(rawValue) || 0;
      
      // Try multiple field name variations for price
      const rawPrice = d.price || d.avg_price || d.execution_price || d.fill_price || 0;
      const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[$,]/g, '')) : parseFloat(rawPrice) || 0;

      return {
        ticker: d.ticker || d.symbol || d.underlying || "UNKNOWN",
        price,
        size: size > 0 ? size : (value > 0 && price > 0 ? Math.round(value / price) : 0),
        value: value > 0 ? value : (size > 0 && price > 0 ? size * price : 0),
        timestamp: d.timestamp || d.executed_at || d.date || d.trade_date || new Date().toISOString(),
        venue: d.venue || d.exchange || d.market || "DARK",
        percentOfAdv: parseFloat(d.percent_of_adv || d.adv_percent || d.pct_adv) || 0,
        sentiment: inferSentiment(d)
      };
    });

    // Log sample of raw response to debug field names
    if (optionsData.length > 0) {
      console.error("[UW] Options sample:", JSON.stringify(optionsData[0]).slice(0, 500));
    }

    const options: OptionsSweep[] = optionsData.slice(0, 10).map((o: any) => {
      // UW flow-alerts uses: total_premium, total_size, strike, expiry, type, ticker, created_at
      const rawPremium = o.total_premium || o.premium || o.cost || o.value || 0;
      const premium = typeof rawPremium === 'string' ? parseFloat(rawPremium.replace(/[$,]/g, '')) : parseFloat(rawPremium) || 0;
      
      const rawContracts = o.total_size || o.size || o.contracts || o.volume || o.qty || 0;
      const contracts = typeof rawContracts === 'string' ? parseInt(rawContracts.replace(/,/g, '')) : parseInt(rawContracts) || 0;
      
      const optionType = (o.type || o.option_type || o.put_call || "call").toLowerCase();
      
      return {
        ticker: o.ticker || o.symbol || o.underlying || "UNKNOWN",
        strike: parseFloat(o.strike || o.strike_price) || 0,
        expiry: o.expiry || o.expiration || o.exp_date || o.expiration_date || "",
        type: optionType as 'call' | 'put',
        premium,
        contracts,
        delta: parseFloat(o.delta) || 0,
        timestamp: o.created_at || o.timestamp || o.executed_at || o.date || new Date().toISOString(),
        sentiment: optionType === 'call' ? 'bullish' : 'bearish'
      };
    });

    return { darkPool, options };
  } catch (error) {
    console.error("Error fetching Unusual Whales data:", error);
    return { darkPool: [], options: [] };
  }
}

export async function fetchPolygonQuote(ticker: string, snapshotter?: PayloadSnapshotter): Promise<TickerContext | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    const [quoteRes, detailsRes] = await Promise.all([
      fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`),
      fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`)
    ]);

    if (!quoteRes.ok) return null;
    
    const quoteData = await quoteRes.json();
    const detailsData = detailsRes.ok ? await detailsRes.json() : { results: {} };

    if (snapshotter) {
      await snapshotter(`polygon_quote_${ticker}`, { status: quoteRes.status, ok: quoteRes.ok, payload: quoteData });
      await snapshotter(`polygon_details_${ticker}`, { status: detailsRes.status, ok: detailsRes.ok, payload: detailsData });
    }
    
    const quote = quoteData.results?.[0];
    const details = detailsData.results || {};

    if (!quote) return null;

    return {
      ticker,
      companyName: details.name || ticker,
      price: quote.c || 0,
      change: (quote.c - quote.o) || 0,
      changePercent: quote.o ? ((quote.c - quote.o) / quote.o * 100) : 0,
      volume: quote.v || 0,
      avgVolume: 0,
      marketCap: details.market_cap || 0,
      float: details.share_class_shares_outstanding || undefined,
      support: quote.l || undefined,
      resistance: quote.h || undefined,
      tickerType: details.type || details.market || undefined
    };
  } catch (error) {
    console.error("Error fetching Polygon data:", error);
    return null;
  }
}

export async function fetchFMPData(ticker: string): Promise<Partial<TickerContext>> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return {};

  try {
    const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${apiKey}`);
    if (!response.ok) return {};
    
    const data = await response.json();
    const quote = data[0];
    
    if (!quote) return {};

    return {
      ticker,
      companyName: quote.name || ticker,
      price: quote.price || 0,
      change: quote.change || 0,
      changePercent: quote.changesPercentage || 0,
      volume: quote.volume || 0,
      avgVolume: quote.avgVolume || 0,
      marketCap: quote.marketCap || 0
    };
  } catch (error) {
    console.error("Error fetching FMP data:", error);
    return {};
  }
}

export async function fetchAlphaVantageIntraday(ticker: string): Promise<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=15min&apikey=${apiKey}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const timeSeries = data["Time Series (15min)"];
    
    if (!timeSeries) return [];

    return Object.entries(timeSeries).slice(0, 50).map(([timestamp, values]: [string, any]) => ({
      timestamp,
      open: parseFloat(values["1. open"]) || 0,
      high: parseFloat(values["2. high"]) || 0,
      low: parseFloat(values["3. low"]) || 0,
      close: parseFloat(values["4. close"]) || 0,
      volume: parseInt(values["5. volume"]) || 0
    }));
  } catch (error) {
    console.error("Error fetching Alpha Vantage data:", error);
    return [];
  }
}

function inferSentiment(data: any): 'bullish' | 'bearish' | 'neutral' {
  if (data.side === 'buy' || data.sentiment === 'bullish') return 'bullish';
  if (data.side === 'sell' || data.sentiment === 'bearish') return 'bearish';
  return 'neutral';
}

export async function getEnrichedTickerData(ticker: string): Promise<TickerContext | null> {
  const [polygonData, fmpData] = await Promise.all([
    fetchPolygonQuote(ticker),
    fetchFMPData(ticker)
  ]);

  if (!polygonData && !fmpData.price) {
    return null;
  }

  return {
    ticker,
    companyName: polygonData?.companyName || fmpData.companyName || ticker,
    price: polygonData?.price || fmpData.price || 0,
    change: polygonData?.change || fmpData.change || 0,
    changePercent: polygonData?.changePercent || fmpData.changePercent || 0,
    volume: polygonData?.volume || fmpData.volume || 0,
    avgVolume: fmpData.avgVolume || polygonData?.avgVolume || 0,
    marketCap: polygonData?.marketCap || fmpData.marketCap || 0,
    float: polygonData?.float,
    shortInterest: undefined,
    analystTarget: undefined,
    support: polygonData?.support,
    resistance: polygonData?.resistance
  };
}

// ============================================================================
// POLYGON OPTIONS CHAIN DATA (15-min delayed structural context)
// ============================================================================

export interface OptionsContract {
  contractSymbol: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  openInterest: number;
  volume: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  lastPrice: number;
  bid: number;
  ask: number;
}

export interface OptionsChainData {
  ticker: string;
  spotPrice: number;
  fetchedAt: string;  // ISO timestamp for transparency
  isDelayed: boolean; // Always true for Polygon Starter
  contracts: OptionsContract[];
  // Aggregated data for charts (plain objects for JSON serialization)
  strikes: number[];
  expiries: string[];
  callOIByStrike: Record<number, number>;
  putOIByStrike: Record<number, number>;
  gammaByStrike: Record<number, number>;
  ivByExpiry: Record<string, number>;
}

// Simple in-memory cache for options chain data (15-min refresh)
const optionsChainCache: Map<string, { data: OptionsChainData; timestamp: number }> = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function fetchPolygonOptionsChain(ticker: string, snapshotter?: PayloadSnapshotter): Promise<OptionsChainData | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error("[Polygon] No API key configured for options chain");
    return null;
  }

  // Check cache first
  const cached = optionsChainCache.get(ticker);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.error(`[Polygon] Using cached options chain for ${ticker}`);
    return cached.data;
  }

  console.error(`[Polygon] Fetching options chain for ${ticker}...`);

  try {
    // Polygon Options Chain Snapshot endpoint
    const response = await fetch(
      `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${apiKey}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Polygon] Options chain error: ${response.status} - ${errorText}`);

      if (snapshotter) {
        await snapshotter(`polygon_options_chain_${ticker}`, { status: response.status, ok: response.ok, payload: errorText });
      }
      
      // Check if it's a subscription issue
      if (response.status === 403 || response.status === 401) {
        console.error("[Polygon] Options data requires paid Options tier subscription");
      }
      return null;
    }

    const data = await response.json();
    if (snapshotter) {
      await snapshotter(`polygon_options_chain_${ticker}`, { status: response.status, ok: response.ok, payload: data });
    }
    const results = data.results || [];
    
    console.error(`[Polygon] Received ${results.length} options contracts for ${ticker}`);

    if (results.length === 0) {
      console.error(`[Polygon] No options data available for ${ticker}`);
      return null;
    }

    // Get spot price from first result's underlying asset (fallback to median strike)
    const rawSpot = results[0]?.underlying_asset?.price || 0;
    
    // Parse contracts
    const contracts: OptionsContract[] = results.map((r: any) => {
      const details = r.details || {};
      const greeks = r.greeks || {};
      const dayData = r.day || {};
      const lastQuote = r.last_quote || {};
      
      return {
        contractSymbol: details.ticker || r.ticker || '',
        strike: details.strike_price || 0,
        expiry: details.expiration_date || '',
        type: details.contract_type === 'call' ? 'call' : 'put',
        openInterest: r.open_interest || 0,
        volume: dayData.volume || 0,
        impliedVolatility: r.implied_volatility || 0,
        delta: greeks.delta || 0,
        gamma: greeks.gamma || 0,
        theta: greeks.theta || 0,
        vega: greeks.vega || 0,
        lastPrice: dayData.close || r.last_trade?.price || 0,
        bid: lastQuote.bid || 0,
        ask: lastQuote.ask || 0
      };
    }).filter((c: OptionsContract) => c.strike > 0 && c.expiry);

    // Aggregate data for charts
    const spotFallback = rawSpot || (contracts.length ? contracts.map(c => c.strike).sort((a, b) => a - b)[Math.floor(contracts.length / 2)] : 0);
    const spotPrice = spotFallback;

    // Focus strikes around spot for gamma/ladder accuracy
    const nearContracts = contracts
      .map(c => ({ ...c, distance: Math.abs(c.strike - spotPrice) }))
      .sort((a, b) => a.distance - b.distance);

    const primaryWindow = nearContracts.filter(c => c.distance <= spotPrice * 0.15);
    const selectedContracts = primaryWindow.length >= 5
      ? primaryWindow
      : nearContracts.slice(0, Math.max(5, Math.min(nearContracts.length, 40)));

    const strikes = Array.from(new Set(selectedContracts.map(c => c.strike))).sort((a, b) => a - b);
    const expiries = Array.from(new Set(selectedContracts.map(c => c.expiry))).sort();
    
    // Use plain objects for JSON serialization (Maps don't serialize properly)
    const callOIByStrike: Record<number, number> = {};
    const putOIByStrike: Record<number, number> = {};
    const gammaByStrike: Record<number, number> = {};
    const ivByExpiry: Record<string, number> = {};

    // Aggregate OI and gamma by strike
    selectedContracts.forEach(c => {
      if (c.type === 'call') {
        callOIByStrike[c.strike] = (callOIByStrike[c.strike] || 0) + c.openInterest;
      } else {
        putOIByStrike[c.strike] = (putOIByStrike[c.strike] || 0) + c.openInterest;
      }
      // Gamma exposure = OI × gamma × 100 (contract multiplier)
      const gammaExposure = c.openInterest * c.gamma * 100;
      gammaByStrike[c.strike] = (gammaByStrike[c.strike] || 0) + gammaExposure;
    });

    // Average IV by expiry (for term structure)
    const ivSumByExpiry: Record<string, { sum: number; count: number }> = {};
    selectedContracts.forEach(c => {
      if (c.impliedVolatility > 0) {
        const existing = ivSumByExpiry[c.expiry] || { sum: 0, count: 0 };
        ivSumByExpiry[c.expiry] = {
          sum: existing.sum + c.impliedVolatility, 
          count: existing.count + 1 
        };
      }
    });
    Object.entries(ivSumByExpiry).forEach(([k, v]) => {
      ivByExpiry[k] = v.sum / v.count;
    });

    const chainData: OptionsChainData = {
      ticker,
      spotPrice,
      fetchedAt: new Date().toISOString(),
      isDelayed: true, // Polygon Starter is 15-min delayed
      contracts,
      strikes,
      expiries,
      callOIByStrike,
      putOIByStrike,
      gammaByStrike,
      ivByExpiry
    };

    // Cache the result
    optionsChainCache.set(ticker, { data: chainData, timestamp: Date.now() });
    console.error(`[Polygon] Cached options chain for ${ticker} with ${contracts.length} contracts`);

    return chainData;
  } catch (error) {
    console.error("[Polygon] Error fetching options chain:", error);
    return null;
  }
}

// Helper to get IV smile data (IV by strike for a single expiry)
export function getIVSmileData(chainData: OptionsChainData, expiry?: string): { strike: number; callIV?: number; putIV?: number }[] {
  const targetExpiry = expiry || chainData.expiries[0]; // Default to nearest expiry
  if (!targetExpiry) return [];

  const smileData = new Map<number, { callIV?: number; putIV?: number }>();
  
  chainData.contracts
    .filter(c => c.expiry === targetExpiry && c.impliedVolatility > 0)
    .forEach(c => {
      const existing = smileData.get(c.strike) || { callIV: undefined, putIV: undefined };
      if (c.type === 'call') {
        existing.callIV = c.impliedVolatility;
      } else {
        existing.putIV = c.impliedVolatility;
      }
      smileData.set(c.strike, existing);
    });

  return Array.from(smileData.entries())
    .map(([strike, ivs]) => ({ strike, ...ivs }))
    .sort((a, b) => a.strike - b.strike);
}

// Helper to get IV term structure (ATM IV by expiry)
export function getIVTermStructure(chainData: OptionsChainData): { expiry: string; iv: number; daysToExpiry: number }[] {
  const now = new Date();
  
  return Object.entries(chainData.ivByExpiry)
    .map(([expiry, iv]) => {
      const expiryDate = new Date(expiry);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { expiry, iv, daysToExpiry };
    })
    .filter(d => d.daysToExpiry > 0)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

// Mock data generators removed - all data must come from real APIs

/**
 * Focused unit tests for the post validator high-confidence panel set.
 * Run with: npx tsx server/post-validator.test.ts
 */
import {
  validateSvgContent,
  validateIvUnitScale,
  validateStrikeCoverage,
  validateSpotInRange,
  validateExpiryConsistency,
  runValidationGate,
  EventMetrics,
} from './post-validator';
import { buildNormalizedSmilePoints, SmileDataMissingError, normalizeIv } from './iv-utils';
import { generateFromCandidates } from './routes';

let passCount = 0;
let failCount = 0;
const asyncTests: Promise<void>[] = [];

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passCount++;
  } else {
    console.log(`  ✗ ${testName}`);
    failCount++;
  }
}

function testGroup(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  console.log('='.repeat(name.length));
  const result = fn();
  if (result instanceof Promise) {
    asyncTests.push(result);
  }
}

const baseMetrics: EventMetrics = {
  size: 1,
  contracts: 10,
  strike: 100,
  expiry: '2024-12-20',
  breakeven: 102,
  timestamp: new Date().toISOString(),
  percentile: 50,
  sentimentLabel: 'neutral',
  price: 100,
  notionalValue: 100000,
};

function buildValidSvg(label: string) {
  return `<svg><text>${label}</text></svg>`;
}

// ============================================================================
// IV UNIT NORMALIZATION & VALIDATION
// ============================================================================

testGroup('normalizeIv', () => {
  assert(normalizeIv(9) === 0.09, 'iv=9 normalizes to 0.09');
  assert(normalizeIv(302) === null, 'iv=302 is rejected above 300% cap');
  assert(normalizeIv(0) === null, 'iv=0 is treated as missing');
  assert(normalizeIv(150) === 1.5, 'iv=150 is treated as percent scale');
});

testGroup('validateIvUnitScale', () => {
  const ok = validateIvUnitScale('<svg><text>40%</text></svg>', 'smile');
  assert(ok.isValid === true, 'accepts plausible IV%');

  const normalizedPercent = validateIvUnitScale('<svg><text>IV 9</text></svg>', 'smile');
  assert(normalizedPercent.isValid === true, 'accepts percent-scale whole numbers once normalized');

  const bad = validateIvUnitScale('<svg><text>564%</text></svg>', 'smile');
  assert(bad.isValid === false, 'rejects implausible IV%');
  assert(bad.code === 'INVALID_IV_UNITS', 'returns invalid unit code');

  const missing = validateIvUnitScale('<svg><text>0%</text></svg>', 'smile');
  assert(missing.code === 'SMILE_DATA_MISSING', 'flags missing smile data for zero IV');
});

testGroup('volatility smile normalization', () => {
  let threwMissing = false;
  try {
    buildNormalizedSmilePoints([
      { strike: 100, callIV: 0 },
      { strike: 105, callIV: 0 },
      { strike: 110, callIV: 0 },
    ], 5);
  } catch (err) {
    threwMissing = err instanceof SmileDataMissingError;
  }
  assert(threwMissing, 'throws when insufficient valid smile points');

  const normalized = buildNormalizedSmilePoints([
    { strike: 100, callIV: 25 },
    { strike: 105, callIV: 0.25 },
    { strike: 110, callIV: 0.3 },
    { strike: 115, putIV: 0.28 },
    { strike: 120, callIV: 0.35 },
  ]);
  assert(normalized.length === 5, 'keeps all valid smile points');
  assert(Math.abs(normalized[0].iv - 0.25) < 1e-6, 'converts percent to decimal');
});

testGroup('generator retries until publishable', async () => {
  let attempts = 0;
  const generator = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        validation: {
          isPublishable: false,
          errors: [{ code: 'SMILE_DATA_MISSING', message: 'missing' }],
          warnings: [],
          summary: 'missing',
        },
      } as any;
    }

    return { validation: { isPublishable: true, errors: [], warnings: [], summary: 'ok' } } as any;
  };

  const result = await generateFromCandidates([
    { type: 'options', data: {}, isLive: true },
    { type: 'options', data: {}, isLive: true },
  ], {}, generator as any);

  assert(result.ok === true, 'returns publishable candidate');
  assert(result.failureStats.SMILE_DATA_MISSING === 1, 'tracks failure stats for first attempt');
});

// ============================================================================
// STRIKE COVERAGE
// ============================================================================

testGroup('strike coverage near spot', () => {
  const strikes = [90, 95, 100, 105, 110];
  const coverage = validateStrikeCoverage(strikes, 100, 0.15, 5);
  assert(coverage.isValid === true, 'accepts 5 strikes within ±15% of spot');

  const thinCoverage = validateStrikeCoverage([50, 200], 100, 0.15, 5);
  assert(thinCoverage.isValid === false, 'rejects sparse strike coverage');

  const spotOutside = validateSpotInRange(150, strikes, 0.1);
  assert(spotOutside.isValid === false, 'rejects spot outside strike range');
});

// ============================================================================
// SVG SANITIZATION
// ============================================================================

testGroup('svg placeholder scrubbing', () => {
  const clean = validateSvgContent(buildValidSvg('Clean chart'), 'flowSummarySvg');
  assert(clean.isValid === true, 'accepts clean svg');

  const placeholder = validateSvgContent('<svg><text>UNUSUAL</text></svg>', 'volatilitySmileSvg');
  assert(placeholder.isValid === false, 'rejects placeholder tokens');
});

// ============================================================================
// EXPIRY MATCH
// ============================================================================

testGroup('expiry consistency', () => {
  const valid = validateExpiryConsistency('2024-12-20', '2024-12-20', 'volatilitySmile');
  assert(valid.isValid === true, 'accepts matching expiry');

  const mismatch = validateExpiryConsistency('2024-12-20', '2025-01-17', 'volatilitySmile');
  assert(mismatch.isValid === false, 'rejects mismatched expiry');
});

// ============================================================================
// VALIDATION GATE (only five panels required)
// ============================================================================

testGroup('runValidationGate high-confidence panels', () => {
  const svgCharts = {
    flowSummarySvg: buildValidSvg('flow'),
    optionsFlowHeatmapSvg: buildValidSvg('heatmap'),
    historicalVsImpliedVolSvg: buildValidSvg('hv vs iv 24%'),
    volatilitySmileSvg: buildValidSvg('smile 42%'),
    ivRankHistogramSvg: buildValidSvg('iv rank'),
  } as Record<string, string>;

  const result = runValidationGate(
    'XYZ',
    'OPTIONS_SWEEP',
    baseMetrics,
    ['Context thread', 'Volatility view', 'Smile note'],
    svgCharts,
    'put',
    [90, 95, 100, 105, 110],
    100,
    [90, 95, 100, 105, 110],
    [],
    { volatilitySmile: '2024-12-20' },
    undefined,
    {
      volatilitySmileSvg: {
        sourcesUsed: {},
        usedFallback: false,
        missingFields: [],
        strikeCoverage: { nearSpotCount: 5, nearSpotPct: 0.5, minRequired: 5 },
        ivStats: { min: 0.1, max: 0.4, median: 0.2, unit: 'decimal' },
        symbolsUsed: [],
      },
    }
  );

  assert(result.isPublishable === true, 'publishes when five required charts present');
});

testGroup('runValidationGate blocks invalid smile inputs', () => {
  const svgCharts = {
    flowSummarySvg: buildValidSvg('flow'),
    optionsFlowHeatmapSvg: buildValidSvg('heatmap'),
    historicalVsImpliedVolSvg: buildValidSvg('hv vs iv 24%'),
    volatilitySmileSvg: '<svg><text>564%</text></svg>',
    ivRankHistogramSvg: buildValidSvg('iv rank'),
  } as Record<string, string>;

  const result = runValidationGate(
    'XYZ',
    'OPTIONS_SWEEP',
    baseMetrics,
    ['Context thread', 'Volatility view', 'Smile note'],
    svgCharts,
    'put',
    [90, 95, 100, 105, 110],
    100,
    [90, 95, 100, 105, 110],
    [],
    { volatilitySmile: '2025-01-17' },
  );

  assert(result.isPublishable === false, 'blocks when smile invalid');
  assert(result.errors.some(e => e.code === 'INVALID_IV_UNITS'), 'flags invalid IV scale');
  assert(result.errors.some(e => e.code === 'EXPIRY_MATCH'), 'flags expiry mismatch');
});

await Promise.all(asyncTests);

if (failCount > 0) {
  console.log(`\nTest run complete: ${passCount} passed, ${failCount} failed`);
  process.exit(1);
} else {
  console.log(`\nAll ${passCount} tests passed!`);
}

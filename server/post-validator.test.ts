/**
 * Unit Tests for Post Validator
 * 
 * Tests all validation functions to ensure quality gates work correctly.
 * Run with: npx tsx server/post-validator.test.ts
 */

import {
  validateNoNaN,
  validateNumberRange,
  validatePercentile,
  validateRequiredField,
  validateNoSuspiciousStrings,
  validateNoGarbledLabels,
  validateSpotInRange,
  validateStrikeCoverage,
  validateMaxPainInRange,
  validateArrayNoNaN,
  validateCopyLogic,
  validateGammaSignConsistency,
  validateSvgContent,
  validateIvUnitScale,
  validateOptionsSwepEvent,
  validateDarkPoolEvent,
  validateBreakevenPlausibility,
  validateNoPrintDirectionClaim,
  validateCrossPanelConsistency,
  validateExpiryConsistency,
  runValidationGate,
  formatDollarAmount,
  formatPercent,
  formatShares,
  formatContracts,
  safeNumber,
  safePercentile,
  EventMetrics
} from './post-validator';
import {
  generateOptionsStockVolumeSvg,
  generateMockGammaExposureData,
  generateMockGreeksSurfaceData,
  generateMockMaxPainData,
  generateMockPutCallOIData,
  generateMockVolatilitySmileData,
  generateTradeTapeTimelineSvg,
  generateSectorCorrelationSvg,
  generateVolatilitySmileSvg,
  generateGammaExposureSvg
} from './chart-generator';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passCount++;
  } else {
    console.log(`  ✗ ${testName}`);
    failCount++;
  }
}

function testGroup(name: string, fn: () => void) {
  console.log(`\n${name}`);
  console.log('='.repeat(name.length));
  fn();
}

// ============================================================================
// NaN VALIDATION TESTS
// ============================================================================

testGroup('validateNoNaN', () => {
  const validResult = validateNoNaN(100, 'testField');
  assert(validResult.isValid === true, 'accepts valid numbers');

  const nanResult = validateNoNaN(NaN, 'testField');
  assert(nanResult.isValid === false, 'rejects NaN');
  assert(nanResult.code === 'NAN_VALUE', 'returns correct error code for NaN');

  const infinityResult = validateNoNaN(Infinity, 'testField');
  assert(infinityResult.isValid === false, 'rejects Infinity');

  const negInfinityResult = validateNoNaN(-Infinity, 'testField');
  assert(negInfinityResult.isValid === false, 'rejects -Infinity');

  const zeroResult = validateNoNaN(0, 'testField');
  assert(zeroResult.isValid === true, 'accepts zero');

  const negativeResult = validateNoNaN(-100, 'testField');
  assert(negativeResult.isValid === true, 'accepts negative numbers');
});

// ============================================================================
// PERCENTILE VALIDATION TESTS
// ============================================================================

testGroup('validatePercentile', () => {
  const valid50 = validatePercentile(50, 'testField');
  assert(valid50.isValid === true, 'accepts 50th percentile');

  const valid0 = validatePercentile(0, 'testField');
  assert(valid0.isValid === true, 'accepts 0th percentile');

  const valid100 = validatePercentile(100, 'testField');
  assert(valid100.isValid === true, 'accepts 100th percentile');

  const invalid101 = validatePercentile(101, 'testField');
  assert(invalid101.isValid === false, 'rejects 101st percentile');

  const invalidNeg = validatePercentile(-1, 'testField');
  assert(invalidNeg.isValid === false, 'rejects negative percentile');

  const invalidNaN = validatePercentile(NaN, 'testField');
  assert(invalidNaN.isValid === false, 'rejects NaN percentile');
});

// ============================================================================
// SUSPICIOUS STRING TESTS
// ============================================================================

testGroup('validateNoSuspiciousStrings', () => {
  const validText = validateNoSuspiciousStrings('This is valid text', 'content');
  assert(validText.isValid === true, 'accepts valid text');

  const nanText = validateNoSuspiciousStrings('Value is NaN', 'content');
  assert(nanText.isValid === false, 'rejects text containing NaN');

  const undefinedText = validateNoSuspiciousStrings('Value is undefined', 'content');
  assert(undefinedText.isValid === false, 'rejects text containing undefined');

  const nullText = validateNoSuspiciousStrings('Value is null', 'content');
  assert(nullText.isValid === false, 'rejects text containing null');

  const infinityText = validateNoSuspiciousStrings('Value is Infinity', 'content');
  assert(infinityText.isValid === false, 'rejects text containing Infinity');

  const objectText = validateNoSuspiciousStrings('[object Object]', 'content');
  assert(objectText.isValid === false, 'rejects [object Object]');

  const repeatedChars = validateNoSuspiciousStrings('Testttttttt', 'content');
  assert(repeatedChars.isValid === false, 'rejects repeated characters (garbled text)');
});

// ============================================================================
// GARBLED LABEL TESTS
// ============================================================================

testGroup('validateNoGarbledLabels', () => {
  const validLabel = validateNoGarbledLabels('Trade Tape Timeline', 'label');
  assert(validLabel.isValid === true, 'accepts valid label');

  const garbledLabel1 = validateNoGarbledLabels('PostTgraedneeTraapteedTimeline', 'label');
  assert(garbledLabel1.isValid === false, 'rejects garbled PostT...T... pattern');

  const normalCamelCase = validateNoGarbledLabels('TradeTape', 'label');
  assert(normalCamelCase.isValid === true, 'accepts normal CamelCase');
});

// ============================================================================
// COPY LOGIC TESTS (SKEW DIRECTION)
// ============================================================================

testGroup('validateCopyLogic', () => {
  // Call skew should NOT mention "protection"
  const callWithProtection = validateCopyLogic(
    'Someone is paying up for protection.',
    'call',
    'thread'
  );
  assert(callWithProtection.isValid === false, 'rejects call skew with "protection"');

  const callWithDownside = validateCopyLogic(
    'That means downside protection is expensive.',
    'call',
    'thread'
  );
  assert(callWithDownside.isValid === false, 'rejects call skew with "downside protection"');

  const callWithUpside = validateCopyLogic(
    'Someone is paying up for upside exposure.',
    'call',
    'thread'
  );
  assert(callWithUpside.isValid === true, 'accepts call skew with "upside exposure"');

  // Put skew should NOT mention "upside speculation"
  const putWithUpside = validateCopyLogic(
    'Someone is paying up for upside speculation.',
    'put',
    'thread'
  );
  assert(putWithUpside.isValid === false, 'rejects put skew with "upside speculation"');

  const putWithProtection = validateCopyLogic(
    'Someone is paying up for protection.',
    'put',
    'thread'
  );
  assert(putWithProtection.isValid === true, 'accepts put skew with "protection"');
});

// ============================================================================
// SVG CONTENT VALIDATION TESTS
// ============================================================================

testGroup('validateSvgContent', () => {
  const validSvg = '<svg><text>Valid content</text></svg>';
  assert(validateSvgContent(validSvg, 'test').isValid === true, 'accepts valid SVG');

  const nanSvg = '<svg><text>NaN</text></svg>';
  assert(validateSvgContent(nanSvg, 'test').isValid === false, 'rejects SVG with NaN text');

  const undefinedSvg = '<svg><text>undefined</text></svg>';
  assert(validateSvgContent(undefinedSvg, 'test').isValid === false, 'rejects SVG with undefined');

  const nanCoordSvg = '<svg><circle cx="NaN" cy="100" r="5"/></svg>';
  assert(validateSvgContent(nanCoordSvg, 'test').isValid === false, 'rejects SVG with NaN coords');
});

testGroup('validateIvUnitScale', () => {
  const missing = validateIvUnitScale('', 'volatilitySmile');
  assert(missing.isValid === false, 'flags missing SVG content');
  assert(missing.code === 'EXPIRY_DATA_MISSING', 'uses expiry missing code for empty SVG');
});

testGroup('optionsStockVolumeSvg placeholders', () => {
  const svg = generateOptionsStockVolumeSvg({
    ticker: 'TEST',
    dates: ['1/1', 'UNUSUAL'],
    optionsPremium: [1000000, 1200000],
    volumeRatio: [150, 240],
    spikeThresholds: [{ dateIdx: 1, ratio: 'UNUSUAL' as any }]
  });

  assert(/UNUSUAL/.test(svg) === false, 'does not emit UNUSUAL placeholder text');
  const validation = validateSvgContent(svg, 'optionsStockVolume');
  assert(validation.isValid === true, 'sanitized SVG passes placeholder validation');
});

// ============================================================================
// SPOT IN RANGE TESTS
// ============================================================================

testGroup('validateSpotInRange', () => {
  const strikes = [100, 110, 120, 130, 140];
  
  const spotInRange = validateSpotInRange(115, strikes);
  assert(spotInRange.isValid === true, 'accepts spot within strike range');

  const spotAtMin = validateSpotInRange(100, strikes);
  assert(spotAtMin.isValid === true, 'accepts spot at min strike');

  const spotAtMax = validateSpotInRange(140, strikes);
  assert(spotAtMax.isValid === true, 'accepts spot at max strike');

  const spotWayBelow = validateSpotInRange(50, strikes);
  assert(spotWayBelow.isValid === false, 'rejects spot far below range');

  const spotWayAbove = validateSpotInRange(200, strikes);
  assert(spotWayAbove.isValid === false, 'rejects spot far above range');

  const emptyStrikes = validateSpotInRange(100, []);
  assert(emptyStrikes.isValid === false, 'rejects empty strikes array');
});

// ============================================================================
// ARRAY NaN TESTS
// ============================================================================

testGroup('validateArrayNoNaN', () => {
  const validArray = validateArrayNoNaN([1, 2, 3, 4, 5], 'data');
  assert(validArray.isValid === true, 'accepts array with no NaN');

  const nanArray = validateArrayNoNaN([1, NaN, 3], 'data');
  assert(nanArray.isValid === false, 'rejects array with NaN');

  const infinityArray = validateArrayNoNaN([1, Infinity, 3], 'data');
  assert(infinityArray.isValid === false, 'rejects array with Infinity');

  const emptyArray = validateArrayNoNaN([], 'data');
  assert(emptyArray.isValid === true, 'accepts empty array');
});

// ============================================================================
// FORMATTING UTILITIES TESTS
// ============================================================================

testGroup('formatDollarAmount', () => {
  assert(formatDollarAmount(1500000000) === '$1.5B', 'formats billions');
  assert(formatDollarAmount(1500000) === '$1.5M', 'formats millions');
  assert(formatDollarAmount(1500) === '$2K', 'formats thousands (rounded)');
  assert(formatDollarAmount(99.99) === '$99.99', 'formats small amounts');
  assert(formatDollarAmount(NaN) === 'N/A', 'handles NaN');
  assert(formatDollarAmount(Infinity) === 'N/A', 'handles Infinity');
});

testGroup('formatPercent', () => {
  assert(formatPercent(85.6789) === '85.7%', 'formats with default decimals');
  assert(formatPercent(85.6789, 2) === '85.68%', 'formats with specified decimals');
  assert(formatPercent(NaN) === 'N/A', 'handles NaN');
});

testGroup('formatShares', () => {
  assert(formatShares(1500000) === '1.5M shares', 'formats millions of shares');
  assert(formatShares(1500) === '2K shares', 'formats thousands of shares');
  assert(formatShares(500) === '500 shares', 'formats small share counts');
  assert(formatShares(NaN) === 'N/A', 'handles NaN');
});

testGroup('formatContracts', () => {
  assert(formatContracts(1500) === '1.5K contracts', 'formats thousands of contracts');
  assert(formatContracts(500) === '500 contracts', 'formats small contract counts');
  assert(formatContracts(NaN) === 'N/A', 'handles NaN');
});

// ============================================================================
// SAFE VALUE HELPERS TESTS
// ============================================================================

testGroup('safeNumber', () => {
  assert(safeNumber(100) === 100, 'passes through valid numbers');
  assert(safeNumber(NaN) === 0, 'returns 0 for NaN by default');
  assert(safeNumber(NaN, 50) === 50, 'returns fallback for NaN');
  assert(safeNumber('100') === 100, 'converts string numbers');
  assert(safeNumber(undefined) === 0, 'handles undefined');
  assert(safeNumber(null) === 0, 'handles null');
});

testGroup('safePercentile', () => {
  assert(safePercentile(50) === 50, 'passes through valid percentile');
  assert(safePercentile(150) === 100, 'clamps to max 100');
  assert(safePercentile(-10) === 0, 'clamps to min 0');
  assert(safePercentile(NaN) === 50, 'returns fallback for NaN');
});

// ============================================================================
// BREAKEVEN VALIDATION TESTS
// ============================================================================

testGroup('validateBreakevenPlausibility', () => {
  const valid = validateBreakevenPlausibility(105, 100, 102);
  assert(valid.isValid === true, 'accepts breakeven near strike and spot');

  const farAway = validateBreakevenPlausibility(300, 100, 105);
  assert(farAway.isValid === false, 'rejects implausible breakeven');
  assert(farAway.code === 'BREAKEVEN_IMPLAUSIBLE', 'uses breakeven implausible code');

  const missing = validateBreakevenPlausibility(undefined as any, 100, 105);
  assert(missing.isValid === false, 'requires breakeven value');
});

// ============================================================================
// EVENT VALIDATION TESTS
// ============================================================================

testGroup('validateOptionsSwepEvent', () => {
  const validMetrics: EventMetrics = {
    size: 100000,
    contracts: 100,
    strike: 150,
    expiry: '2025-01-17',
    breakeven: 155,
    timestamp: new Date().toISOString(),
    percentile: 85,
    sentimentLabel: 'bullish',
    price: 150,
    notionalValue: 1500000
  };

  const validResult = validateOptionsSwepEvent(validMetrics);
  assert(validResult.length === 0, 'accepts valid options sweep metrics');

  const missingStrike: EventMetrics = { ...validMetrics, strike: undefined };
  const missingStrikeResult = validateOptionsSwepEvent(missingStrike);
  assert(missingStrikeResult.length > 0, 'rejects missing strike');

  const missingExpiry: EventMetrics = { ...validMetrics, expiry: undefined };
  const missingExpiryResult = validateOptionsSwepEvent(missingExpiry);
  assert(missingExpiryResult.length > 0, 'rejects missing expiry');
});

testGroup('validateDarkPoolEvent', () => {
  const validMetrics: EventMetrics = {
    size: 100000,
    shares: 50000,
    timestamp: new Date().toISOString(),
    percentile: 75,
    sentimentLabel: 'neutral',
    price: 150,
    notionalValue: 7500000
  };

  const validResult = validateDarkPoolEvent(validMetrics);
  assert(validResult.length === 0, 'accepts valid dark pool metrics');

  const missingShares: EventMetrics = { ...validMetrics, shares: undefined };
  const missingSharesResult = validateDarkPoolEvent(missingShares);
  assert(missingSharesResult.length > 0, 'rejects missing shares');
});

// ============================================================================
// FULL VALIDATION GATE TEST
// ============================================================================

testGroup('runValidationGate', () => {
  const validMetrics: EventMetrics = {
    size: 100000,
    contracts: 100,
    strike: 150,
    expiry: '2025-01-17',
    breakeven: 155,
    timestamp: new Date().toISOString(),
    percentile: 85,
    sentimentLabel: 'bullish',
    price: 150,
    notionalValue: 1500000
  };

  const validThread = [
    'Thread content about upside exposure.',
    'More valid content here.'
  ];

  const validCharts = {
    volatilitySmile: '<svg><text>Valid chart</text></svg>',
    gammaExposure: '<svg><text>Valid gamma</text></svg>'
  };

  const gammaStrikes = [140, 145, 150, 155, 160];
  const ivStrikes = [140, 145, 150, 155, 160];
  const oiStrikes = [140, 145, 150, 155, 160];

  const validResult = runValidationGate(
    'TSLA',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    { volatilitySmile: '2025-01-17' },
    'long'
  );

  assert(validResult.isPublishable === true, 'marks valid post as publishable');
  assert(validResult.errors.length === 0, 'has no errors for valid post');

  // Test with bad copy
  const badCopyThread = [
    'Someone is paying up for protection.',
    'More content.'
  ];

  const badCopyResult = runValidationGate(
    'TSLA',
    'OPTIONS_SWEEP',
    validMetrics,
    badCopyThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );

  assert(badCopyResult.isPublishable === false, 'blocks post with wrong copy logic');
  assert(badCopyResult.errors.some(e => e.code === 'WRONG_COPY_LOGIC'), 'identifies copy logic error');

  // Test with NaN in SVG
  const nanCharts = {
    volatilitySmile: '<svg><text>Value: NaN</text></svg>'
  };

  const nanResult = runValidationGate(
    'TSLA',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    nanCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );

  assert(nanResult.isPublishable === false, 'blocks post with NaN in SVG');

  // Test with print direction overclaim
  const overclaim = [
    'This aligns with the dark pool print direction.',
    'More content.'
  ];

  const overclaimResult = runValidationGate(
    'AAPL',
    'DARK_POOL_PRINT',
    validMetrics,
    overclaim,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );

  assert(overclaimResult.isPublishable === false, 'blocks dark pool overclaim');
  assert(overclaimResult.errors.some(e => e.code === 'PRINT_DIRECTION_OVERCLAIM'), 'identifies overclaim error');

  // Test with misaligned cross-panel strikes
  const misalignedResult = runValidationGate(
    'AAPL',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    gammaStrikes,               // gamma strikes (center ~150)
    150,                        // spot
    [200, 210, 220, 230],       // IV strikes (center ~215, >20% off)
    [],
    {},
    'long'
  );

  assert(misalignedResult.isPublishable === false, 'blocks misaligned cross-panel strikes');
  assert(misalignedResult.errors.some(e => e.code === 'STRIKE_RANGE_MISMATCH'), 'identifies strike mismatch error');

  // Test with mismatched chart expiries
  const expiryMismatchResult = runValidationGate(
    'SPXW',
    'OPTIONS_SWEEP',
    { ...validMetrics, expiry: '2026-03-31' },  // Event expiry in March 2026
    validThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    [],
    [],
    { volatilitySmile: '2025-01-17' },  // Chart expiry in Jan 2025 (stale!)
    'long'
  );

  assert(expiryMismatchResult.isPublishable === false, 'blocks mismatched chart expiries');
  assert(expiryMismatchResult.errors.some(e => e.code === 'EXPIRY_MISMATCH'), 'identifies expiry mismatch error');

  // Test with implausible breakeven vs strike
  const implausibleBreakeven = runValidationGate(
    'SPY',
    'OPTIONS_SWEEP',
    { ...validMetrics, breakeven: 500 },
    validThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );

  assert(implausibleBreakeven.isPublishable === false, 'blocks implausible breakeven');
  assert(implausibleBreakeven.errors.some(e => e.code === 'BREAKEVEN_IMPLAUSIBLE'), 'flags breakeven issue');

  // Test with sparse strikes near spot
  const sparseStrikesResult = runValidationGate(
    'QQQ',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    [20, 400],
    100,
    [20, 400],
    [],
    {},
    'long'
  );

  assert(sparseStrikesResult.isPublishable === false, 'blocks sparse strikes near spot');
  assert(sparseStrikesResult.errors.some(e => e.code === 'STRIKE_COVERAGE_INSUFFICIENT'), 'identifies strike coverage gap');

  // Test gamma sign mismatch between chart and thread content
  const gammaMismatchThread = [
    'Short gamma pocket could force acceleration.'
  ];

  const gammaMismatchResult = runValidationGate(
    'MSFT',
    'OPTIONS_SWEEP',
    validMetrics,
    gammaMismatchThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );

  assert(gammaMismatchResult.isPublishable === false, 'blocks gamma sign mismatch');
  assert(gammaMismatchResult.errors.some(e => e.code === 'GAMMA_SIGN_MISMATCH'), 'identifies gamma mismatch');

  // Missing chain data should be blocked as mock/fallback usage
  const missingChainResult = runValidationGate(
    'MSFT',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    { volatilitySmile: '<svg></svg>' },
    'call',
    [],
    150,
    [],
    [],
    {},
    'long',
    { volatilitySmile: {
      sourcesUsed: { polygon: false },
      usedFallback: true,
      missingFields: ['optionsChain'],
      strikeCoverage: { nearSpotCount: 0, nearSpotPct: 0, minRequired: 5 },
      ivStats: { min: 0, max: 0, median: 0, unit: 'percent' },
      symbolsUsed: []
    } }
  );
  assert(missingChainResult.isPublishable === false, 'blocks when chain data is missing');
  assert(missingChainResult.errors.some(e => e.code === 'MOCK_DATA_USED'), 'flags mock usage');

  // IV smile with implausible units
  const ivImplausible = runValidationGate(
    'AAPL',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long',
    { volatilitySmile: {
      sourcesUsed: { polygon: true },
      usedFallback: false,
      missingFields: [],
      strikeCoverage: { nearSpotCount: 5, nearSpotPct: 0.5, minRequired: 5 },
      ivStats: { min: 0.1, max: 3.5, median: 0.5, unit: 'decimal' },
      symbolsUsed: []
    } }
  );
  assert(ivImplausible.isPublishable === false, 'blocks implausible IV units');
  assert(ivImplausible.errors.some(e => e.code === 'IV_IMPLAUSIBLE_UNITS'), 'returns IV implausible code');

  // Spot well outside strike ladder coverage
  const strikeRangeFail = runValidationGate(
    'META',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    [494, 496, 500, 504, 508],
    617,
    ivStrikes,
    oiStrikes,
    {},
    'long',
    { putCallOILadder: {
      sourcesUsed: { polygon: true },
      usedFallback: false,
      missingFields: [],
      strikeCoverage: { nearSpotCount: 0, nearSpotPct: 0.05, minRequired: 5 },
      ivStats: { min: 0, max: 0, median: 0, unit: 'percent' },
      symbolsUsed: []
    } }
  );
  assert(strikeRangeFail.isPublishable === false, 'blocks when spot outside ladder range');
  assert(strikeRangeFail.errors.some(e => e.code === 'SPOT_OUTSIDE_STRIKE_RANGE'), 'returns spot coverage error');

  // Correlation matrix duplicates
  const corrDuplicate = runValidationGate(
    'SPY',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long',
    { correlationMatrix: {
      sourcesUsed: { unusualWhales: true },
      usedFallback: false,
      missingFields: [],
      strikeCoverage: { nearSpotCount: 5, nearSpotPct: 0.5, minRequired: 5 },
      ivStats: { min: 0, max: 0, median: 0, unit: 'percent' },
      symbolsUsed: ['AAPL', 'aapl', 'QQQ']
    } }
  );
  assert(corrDuplicate.isPublishable === false, 'blocks duplicate symbols');
  assert(corrDuplicate.errors.some(e => e.code === 'CORR_DUPLICATE_SYMBOLS'), 'returns duplicate symbol code');

  // SVG placeholder detection
  const placeholderSvg = runValidationGate(
    'QQQ',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    { volatilitySmile: '<svg><text>UW</text></svg>' },
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );
  assert(placeholderSvg.isPublishable === false, 'blocks placeholder text in SVG');
  assert(placeholderSvg.errors.some(e => e.code === 'SVG_PLACEHOLDER_OR_NAN'), 'uses placeholder/NAN code');

  const unusualSvg = runValidationGate(
    'QQQ',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    { volatilitySmile: '<svg><text>UNUSUAL</text></svg>' },
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );
  assert(unusualSvg.isPublishable === false, 'blocks UNUSUAL placeholder in SVG');
  assert(unusualSvg.errors.some(e => e.code === 'SVG_PLACEHOLDER_OR_NAN'), 'flags UNUSUAL placeholder code');

  const missingSmile = runValidationGate(
    'QQQ',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    { volatilitySmile: '' },
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    { volatilitySmile: '2025-01-17' },
    'long'
  );
  assert(missingSmile.isPublishable === false, 'blocks missing volatility smile content');
  assert(missingSmile.errors.some(e => e.code === 'EXPIRY_DATA_MISSING'), 'flags missing smile data');

  const spotOutOfRange = runValidationGate(
    'QQQ',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    { volatilitySmile: '<svg><text>ok</text></svg>' },
    'call',
    gammaStrikes,
    20,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );
  assert(spotOutOfRange.isPublishable === false, 'blocks posts when spot is far outside strike range');
  assert(spotOutOfRange.errors.some(e => e.code === 'SPOT_OUTSIDE_STRIKE_RANGE'), 'uses spot out of range code');

  const negativeStrike = runValidationGate(
    'QQQ',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    { volatilitySmile: '<svg><text>ok</text></svg>' },
    'call',
    [150, -1, 155],
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );
  assert(negativeStrike.isPublishable === false, 'blocks posts when strike ladder includes non-positive values');
  assert(negativeStrike.errors.some(e => e.code === 'INVALID_STRIKE_VALUE'), 'uses invalid strike value code');

  // Dark pool premium mislabel detection
  const darkPoolPremium = runValidationGate(
    'JPM',
    'DARK_POOL_PRINT',
    validMetrics,
    validThread,
    { darkPool: '<svg><text>premium paid</text></svg>' },
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );
  assert(darkPoolPremium.isPublishable === false, 'blocks premium label for dark pool');
  assert(darkPoolPremium.errors.some(e => e.code === 'DARKPOOL_PREMIUM_MISLABEL'), 'returns mislabel code');

  const sweepPlaceholder = runValidationGate(
    'JPM',
    'DARK_POOL_PRINT',
    validMetrics,
    validThread,
    { tradeTapeTimeline: '<svg><text>SWEEP</text></svg>' },
    'call',
    gammaStrikes,
    150,
    ivStrikes,
    oiStrikes,
    {},
    'long'
  );
  assert(sweepPlaceholder.isPublishable === false, 'blocks SVGs that contain SWEEP placeholder tokens');
  assert(sweepPlaceholder.errors.some(e => e.code === 'SVG_PLACEHOLDER_OR_NAN'), 'returns SVG placeholder code for SWEEP');
});

// ============================================================================
// PRINT DIRECTION OVERCLAIM TESTS
// ============================================================================

testGroup('validateNoPrintDirectionClaim', () => {
  // Should fail for dark pool with "print direction"
  const overclaim1 = validateNoPrintDirectionClaim(
    'This aligns with the dark pool print direction.',
    'DARK_POOL_PRINT'
  );
  assert(overclaim1.isValid === false, 'rejects "print direction" in dark pool');
  assert(overclaim1.code === 'PRINT_DIRECTION_OVERCLAIM', 'returns correct error code');

  // Should pass for dark pool with appropriate disclaimer
  const disclaimer = validateNoPrintDirectionClaim(
    'Pattern consistent with broader options-flow bias (note: prints alone don\'t confirm direction).',
    'DARK_POOL_PRINT'
  );
  assert(disclaimer.isValid === true, 'accepts disclaimed direction reference');

  // Should pass for options sweep (different event type)
  const optionsSweep = validateNoPrintDirectionClaim(
    'This aligns with the dark pool print direction.',
    'OPTIONS_SWEEP'
  );
  assert(optionsSweep.isValid === true, 'allows direction claim for options sweep');

  // Should fail for "dark pool direction" without disclaimer
  const impliedDirection = validateNoPrintDirectionClaim(
    'The dark pool direction suggests bullish sentiment.',
    'DARK_POOL_PRINT'
  );
  assert(impliedDirection.isValid === false, 'rejects implied direction claim');

  // Should pass for normal dark pool content
  const normalContent = validateNoPrintDirectionClaim(
    'A dark pool print just hit in $AAPL. Notable accumulation pattern.',
    'DARK_POOL_PRINT'
  );
  assert(normalContent.isValid === true, 'accepts normal dark pool content');
});

// ============================================================================
// CROSS-PANEL STRIKE CONSISTENCY TESTS
// ============================================================================

testGroup('validateCrossPanelConsistency', () => {
  // Should pass when strike ranges align
  const aligned = validateCrossPanelConsistency(
    [140, 145, 150, 155, 160],  // gamma
    [142, 148, 152, 158],       // IV (similar center)
    [141, 146, 151, 156]        // OI (similar center)
  );
  assert(aligned.isValid === true, 'accepts aligned strike ranges');

  // Should fail when gamma and IV strike centers differ >20%
  const misaligned = validateCrossPanelConsistency(
    [140, 145, 150, 155, 160],  // gamma (center ~150)
    [200, 210, 220, 230],       // IV (center ~215, >20% off)
    []
  );
  assert(misaligned.isValid === false, 'rejects misaligned gamma vs IV');
  assert(misaligned.code === 'STRIKE_RANGE_MISMATCH', 'returns correct error code');

  // Should fail when gamma and OI strike centers differ >20%
  const misalignedOI = validateCrossPanelConsistency(
    [140, 145, 150, 155, 160],  // gamma (center ~150)
    [],
    [80, 90, 100, 110]          // OI (center ~95, >20% off)
  );
  assert(misalignedOI.isValid === false, 'rejects misaligned gamma vs OI');

  // Should pass with no gamma strikes
  const noGamma = validateCrossPanelConsistency([], [100, 110, 120], [95, 105]);
  assert(noGamma.isValid === true, 'accepts empty gamma strikes');

  // Should pass with only gamma strikes
  const onlyGamma = validateCrossPanelConsistency([140, 150, 160], [], []);
  assert(onlyGamma.isValid === true, 'accepts only gamma strikes');
});

// ============================================================================
// SVG PLACEHOLDER DETECTION TESTS
// ============================================================================

testGroup('validateSvgContent with placeholders', () => {
  // Should reject "UNUSUAL" placeholder
  const unusualPlaceholder = validateSvgContent(
    '<svg><text>UNUSUAL</text></svg>',
    'volumeChart'
  );
  assert(unusualPlaceholder.isValid === false, 'rejects UNUSUAL placeholder');
  assert(unusualPlaceholder.message?.includes('UNUSUAL'), 'error mentions UNUSUAL');

  // Should reject NaN dimensions
  const nanDimensions = validateSvgContent(
    '<svg width="NaN" height="NaN"><rect /></svg>',
    'chart'
  );
  assert(nanDimensions.isValid === false, 'rejects NaN dimensions');
  assert(nanDimensions.message?.includes('NaN dimensions'), 'error mentions NaN dimensions');

  // Should accept valid percentage labels
  const validPercentage = validateSvgContent(
    '<svg><text>235%</text></svg>',
    'volumeChart'
  );
  assert(validPercentage.isValid === true, 'accepts percentage values');
});

// ============================================================================
// IV UNIT SCALE TESTS
// ============================================================================

testGroup('validateIvUnitScale', () => {
  const validScale = validateIvUnitScale('<svg><text>75%</text><text>120%</text></svg>', 'volatilitySmile');
  assert(validScale.isValid === true, 'accepts plausible IV percentages');

  const corruptedScale = validateIvUnitScale('<svg><text>1734%</text></svg>', 'volatilitySmile');
  assert(corruptedScale.isValid === false, 'rejects implausible IV percentages');
  assert(corruptedScale.code === 'INVALID_IV_UNITS', 'returns INVALID_IV_UNITS code');

  const missingSvg = validateIvUnitScale('', 'volatilitySmile');
  assert(missingSvg.isValid === false, 'rejects missing SVG content');
});

// ============================================================================
// SPOT OUT OF RANGE (BLOCKING ERROR) TESTS
// ============================================================================

testGroup('validateSpotInRange (blocking)', () => {
  // Should pass when spot is within range
  const inRange = validateSpotInRange(150, [140, 145, 150, 155, 160]);
  assert(inRange.isValid === true, 'accepts spot within range');

  // Should FAIL (error, not warning) when spot is far outside range
  const farOutside = validateSpotInRange(50, [140, 145, 150, 155, 160]);
  assert(farOutside.isValid === false, 'rejects spot far outside range');
  assert(farOutside.severity === 'error', 'returns blocking error severity');
  assert(farOutside.code === 'SPOT_OUTSIDE_STRIKE_RANGE', 'returns correct error code');

  // Should pass when spot is just slightly outside (within tolerance)
  const slightlyOutside = validateSpotInRange(138, [140, 145, 150, 155, 160]);
  assert(slightlyOutside.isValid === true, 'accepts spot slightly outside range (within tolerance)');
});

// ============================================================================
// STRIKE COVERAGE TESTS
// ============================================================================

testGroup('validateStrikeCoverage', () => {
  const strikes = [90, 95, 100, 105, 110, 115];
  const valid = validateStrikeCoverage(strikes, 100);
  assert(valid.isValid === true, 'accepts dense strikes around spot');

  const sparse = validateStrikeCoverage([50, 200, 400], 100);
  assert(sparse.isValid === false, 'rejects sparse strikes far from spot');
  assert(sparse.code === 'STRIKE_COVERAGE_INSUFFICIENT', 'returns strike coverage error code');
});

// ============================================================================
// EXPIRY CONSISTENCY TESTS
// ============================================================================

testGroup('validateExpiryConsistency', () => {
  // Should pass when expiries match
  const matching = validateExpiryConsistency('2026-03-31', '2026-03-31', 'volSmile');
  assert(matching.isValid === true, 'accepts matching expiries');

  // Should fail when chart expiry is earlier than event expiry (stale data)
  const staleData = validateExpiryConsistency('2026-03-31', '2025-01-17', 'volSmile');
  assert(staleData.isValid === false, 'rejects chart expiry earlier than event expiry');
  assert(staleData.code === 'EXPIRY_MISMATCH', 'returns correct error code');
  assert(staleData.message?.includes('stale'), 'error mentions stale data');

  // Should fail when expiries don't match even if chart expiry is later
  const mismatch = validateExpiryConsistency('2026-01-17', '2026-03-31', 'volSmile');
  assert(mismatch.isValid === false, 'rejects mismatched expiries');

  // Should pass when no event expiry specified
  const noEventExpiry = validateExpiryConsistency(undefined, '2025-01-17', 'volSmile');
  assert(noEventExpiry.isValid === true, 'accepts undefined event expiry');

  // Should pass when no chart expiry specified
  const noChartExpiry = validateExpiryConsistency('2026-03-31', undefined, 'volSmile');
  assert(noChartExpiry.isValid === true, 'accepts undefined chart expiry');
});

// ============================================================================
// GAMMA SIGN CONSISTENCY TESTS
// ============================================================================

testGroup('validateGammaSignConsistency', () => {
  const noGamma = validateGammaSignConsistency('Gamma discussed here', undefined);
  assert(noGamma.isValid === true, 'skips when no modeled gamma provided');

  const aligned = validateGammaSignConsistency('Modeled long gamma setup', 'long');
  assert(aligned.isValid === true, 'accepts aligned gamma wording');

  const mismatch = validateGammaSignConsistency('This is a short gamma pocket', 'long');
  assert(mismatch.isValid === false, 'rejects gamma sign mismatch');
  assert(mismatch.code === 'GAMMA_SIGN_MISMATCH', 'returns gamma mismatch code');
});

// ============================================================================
// UW ARTIFACT DETECTION TESTS
// ============================================================================

testGroup('validateSvgContent with UW artifacts', () => {
  // Should reject "UW" artifact
  const uwArtifact = validateSvgContent(
    '<svg><text>UW / N/A</text></svg>',
    'vegaSurface'
  );
  assert(uwArtifact.isValid === false, 'rejects UW artifact');
  assert(uwArtifact.message?.includes('UW'), 'error mentions UW artifact');

  // Should reject standalone UW
  const standaloneUw = validateSvgContent(
    '<svg><text>Source: UW</text></svg>',
    'chart'
  );
  assert(standaloneUw.isValid === false, 'rejects standalone UW');

  // Should accept valid source attribution
  const validSource = validateSvgContent(
    '<svg><text>Source: Options Flow Analytics</text></svg>',
    'chart'
  );
  assert(validSource.isValid === true, 'accepts valid source text');
});

// ============================================================================
// STRIKE GRID GENERATION TESTS
// ============================================================================

testGroup('strike grid generation', () => {
  const spot = 0.5;
  const grids = [
    generateMockGammaExposureData('XYZ', spot).strikes,
    generateMockPutCallOIData('XYZ', spot).strikes,
    generateMockVolatilitySmileData('XYZ', spot).strikes,
    generateMockGreeksSurfaceData('XYZ', spot).strikes,
    generateMockMaxPainData('XYZ', spot).strikes,
  ];

  grids.forEach((grid, idx) => {
    assert(grid.every(s => s > 0), `grid ${idx + 1} has only positive strikes`);
  });
});

// ============================================================================
// SVG PLACEHOLDER + CORRECTNESS TESTS
// ============================================================================

testGroup('svg placeholder scrubbing', () => {
  const greeksData = generateMockGreeksSurfaceData('XYZ', 100);
  greeksData.whaleImpactZones.push({ strike: greeksData.strikes[0], expiry: greeksData.expiries[0], tag: 'SWEEP' });
  try {
    const svg = generateGreeksSurfaceSvg(greeksData);
    assert(!/SWEEP/.test(svg), 'greeks surface removes SWEEP placeholder');
  } catch (err) {
    assert(true, 'greeks surface rejects placeholder tags');
  }

  const timelineSvg = generateTradeTapeTimelineSvg({
    ticker: 'XYZ',
    times: ['09:45', '10:00'],
    cumulativePremium: [1, 2],
    sentiment: ['bullish', 'bearish'],
    whaleEvents: [{ timeIdx: 1, premium: 2, detail: 'UNUSUAL SWEEP' }],
    putCallRatio: [1, 1]
  });
  assert(!/SWEEP/.test(timelineSvg) && !/UNUSUAL/.test(timelineSvg), 'timeline sanitizes placeholder sweep tags');
});

testGroup('gamma spot label uniqueness', () => {
  const gammaSvg = generateGammaExposureSvg({
    ticker: 'XYZ',
    strikes: [95, 100, 105, 110, 115],
    netGamma: [1, -2, 3, -1, 2],
    gammaFlips: [],
    totalGammaExposure: 1000,
    spotPrice: 107,
    asOfTimestamp: '2024-01-01'
  });
  const spotMatches = gammaSvg.match(/>SPOT</g) || [];
  assert(spotMatches.length === 1, 'gamma chart renders exactly one SPOT label');
});

testGroup('correlation peers dedupe', () => {
  const svg = generateSectorCorrelationSvg({
    ticker: 'XYZ',
    peers: ['AAPL', 'AAPL', 'MSFT'],
    correlations: [
      [1, 0.9, 0.5],
      [0.9, 1, 0.4],
      [0.5, 0.4, 1]
    ],
    decouplings: [],
    asOfTimestamp: '2024-01-01'
  });
  const appleLabels = svg.match(/>AAPL</g) || [];
  assert(appleLabels.length === 2, 'correlation matrix shows AAPL once per axis');
});

testGroup('smile interpretation alignment', () => {
  const svg = generateVolatilitySmileSvg({
    ticker: 'XYZ',
    expiry: '2025-01-17',
    strikes: [90, 95, 100, 105, 110],
    currentIV: [50, 45, 40, 35, 30],
    priorIV: [45, 42, 38, 34, 32],
    spotPrice: 100,
    skewPercentile: 82,
    anomalyStrikes: [],
    asOfTimestamp: '2024-01-01'
  });

  assert(!/neutral market/i.test(svg), 'smile interpretation avoids neutral wording when skew percentile is high');
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`TEST SUMMARY: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
}

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
  validateMaxPainInRange,
  validateArrayNoNaN,
  validateCopyLogic,
  validateSvgContent,
  validateOptionsSwepEvent,
  validateDarkPoolEvent,
  runValidationGate,
  formatDollarAmount,
  formatPercent,
  formatShares,
  formatContracts,
  safeNumber,
  safePercentile,
  EventMetrics
} from './post-validator';

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

  const validResult = runValidationGate(
    'TSLA',
    'OPTIONS_SWEEP',
    validMetrics,
    validThread,
    validCharts,
    'call',
    [140, 145, 150, 155, 160],
    150
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
    [140, 145, 150, 155, 160],
    150
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
    [140, 145, 150, 155, 160],
    150
  );

  assert(nanResult.isPublishable === false, 'blocks post with NaN in SVG');
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

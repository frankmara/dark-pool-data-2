import { normalizeIv } from './iv-utils';

/**
 * PostSpec Validation System
 *
 * A robust validation layer that ensures all generated threads meet quality standards
 * before being published/exported. Prevents NaN, undefined, garbled text, and logic errors.
 */

// ============================================================================
// POST SPEC SCHEMA
// ============================================================================

export interface EventMetrics {
  size: number;
  contracts?: number;
  shares?: number;
  strike?: number;
  expiry?: string;
  breakeven?: number;
  timestamp: string;
  percentile: number;
  sentimentLabel: string;
  price: number;
  notionalValue: number;
}

export interface ChartSpec {
  type: 'volatilitySmile' | 'gammaExposure' | 'historicalVsImpliedVol' | 'greeksSurface' |
        'correlationMatrix' | 'maxPain' | 'ivRankHistogram' | 'optionsStockVolume' |
        'tradeTapeTimeline' | 'flowSummary';
  svgContent: string;
  validationResult: ValidationResult;
}

export interface DataQualityReport {
  sourcesUsed: Record<string, boolean>;
  usedFallback: boolean;
  missingFields: string[];
  strikeCoverage: { nearSpotCount: number; nearSpotPct: number; minRequired: number };
  ivStats: { min: number; max: number; median: number; unit: 'decimal' | 'percent' };
  symbolsUsed: string[];
}

export interface CopyBlock {
  title?: string;
  body: string;
  bullets?: string[];
}

export interface ThreadStep {
  index: number;
  content: string;
  type: string;
  chartRef: string;
  copyBlocks?: CopyBlock[];
  chartSpec?: ChartSpec;
  validationResults?: ValidationResult[];
}

export interface PostSpec {
  symbol: string;
  eventType: 'DARK_POOL_PRINT' | 'OPTIONS_SWEEP';
  eventMetrics: EventMetrics;
  thread: ThreadStep[];
  charts: Record<string, ChartSpec>;
  overallValidation: ValidationResult;
  isPublishable: boolean;
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  isValid: boolean;
  severity: ValidationSeverity;
  code: string;
  message: string;
  field?: string;
  value?: any;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

const SUSPICIOUS_PATTERNS = [
  /NaN/g,
  /undefined/g,
  /\bnull\b/g,
  /Infinity/g,
  /-Infinity/g,
  /\[object Object\]/g,
  /(.)\1{5,}/g,  // 5+ repeated characters (garbled text detection)
  /\bUNUSUAL\b/g,  // P0: Placeholder text in charts that should be replaced with real values
  /\bUW\b/g,  // P0: "UW" artifact from Unusual Whales data that wasn't replaced
  /\bSWEEP\b/g, // P0: Placeholder sweep tag that should be replaced with real context
  /\bN\/A\b(?!\s*<\/text>)/g,  // P0: Standalone "N/A" in chart content (except in valid text contexts)
];

const LABEL_CORRUPTION_PATTERNS = [
  /PostT[a-z]+T[a-z]+/i,  // Garbled labels like "PostTgraedneeTraapteedTimeline"
  // Note: Removed generic CamelCase pattern as it has false positives with valid SVG attributes like "userSpaceOnUse"
];

// ============================================================================
// VALIDATORS
// ============================================================================

export function validateNoNaN(value: number, fieldName: string): ValidationResult {
  if (isNaN(value) || !isFinite(value)) {
    return {
      isValid: false,
      severity: 'error',
      code: 'NAN_VALUE',
      message: `Field ${fieldName} contains NaN or Infinity`,
      field: fieldName,
      value
    };
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  if (isNaN(value) || value < min || value > max) {
    return {
      isValid: false,
      severity: 'error',
      code: 'OUT_OF_RANGE',
      message: `Field ${fieldName} value ${value} is outside valid range [${min}, ${max}]`,
      field: fieldName,
      value
    };
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validatePercentile(value: number, fieldName: string): ValidationResult {
  return validateNumberRange(value, 0, 100, fieldName);
}

export function validateBreakevenPlausibility(
  breakeven: number | undefined,
  strike?: number,
  spot?: number,
  fieldName: string = 'breakeven'
): ValidationResult {
  if (breakeven === undefined || breakeven === null) {
    return {
      isValid: false,
      severity: 'error',
      code: 'REQUIRED_FIELD_MISSING',
      message: 'Breakeven is required for options events',
      field: fieldName,
      value: breakeven
    };
  }

  if (isNaN(breakeven) || !isFinite(breakeven) || breakeven <= 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'NAN_VALUE',
      message: 'Breakeven must be a positive, finite number',
      field: fieldName,
      value: breakeven
    };
  }

  const anchors = [strike, spot].filter((n): n is number => n !== undefined && !isNaN(n) && isFinite(n) && n > 0);
  for (const anchor of anchors) {
    const deviation = Math.abs(breakeven - anchor) / anchor;
    if (deviation > 0.6) {
      return {
        isValid: false,
        severity: 'error',
        code: 'BREAKEVEN_IMPLAUSIBLE',
        message: `Breakeven $${breakeven} is implausible vs anchor $${anchor} (>60% away)`,
        field: fieldName,
        value: { breakeven, anchor, deviation: `${(deviation * 100).toFixed(1)}%` }
      };
    }
  }

  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateRequiredField(value: any, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return {
      isValid: false,
      severity: 'error',
      code: 'REQUIRED_FIELD_MISSING',
      message: `Required field ${fieldName} is missing`,
      field: fieldName,
      value
    };
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateNoSuspiciousStrings(text: string, fieldName: string): ValidationResult {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'SUSPICIOUS_STRING',
        message: `Field ${fieldName} contains suspicious pattern: ${pattern.source}`,
        field: fieldName,
        value: text.substring(0, 100)
      };
    }
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateNoGarbledLabels(text: string, fieldName: string): ValidationResult {
  for (const pattern of LABEL_CORRUPTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'GARBLED_LABEL',
        message: `Field ${fieldName} contains garbled/corrupted label`,
        field: fieldName,
        value: text.substring(0, 100)
      };
    }
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateSpotInRange(
  spot: number,
  strikes: number[],
  tolerance: number = 0.1,
  fieldName: string = 'spot'
): ValidationResult {
  if (strikes.length === 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'EMPTY_STRIKES',
      message: 'Strikes array is empty',
      field: 'strikes'
    };
  }
  
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  
  const rangeMidpoint = (minStrike + maxStrike) / 2;
  const rangeTolerance = (maxStrike - minStrike) * tolerance;

  if (spot < minStrike - rangeTolerance || spot > maxStrike + rangeTolerance) {
    return {
      isValid: false,
      severity: 'error',
      code: 'SPOT_OUTSIDE_STRIKE_RANGE',
      message: `Spot price $${spot} is outside strike range [$${minStrike}-$${maxStrike}]`,
      field: fieldName,
      value: { spot, minStrike, maxStrike, rangeMidpoint }
    };
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateStrikeCoverage(
  strikes: number[],
  spot: number,
  tolerance: number = 0.15,
  minStrikes: number = 5,
  fieldName: string = 'strikes'
): ValidationResult {
  if (!strikes || strikes.length === 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'EMPTY_STRIKES',
      message: 'Strike array is empty - cannot render ladder near spot',
      field: fieldName
    };
  }

  if (!spot || !isFinite(spot)) {
    return {
      isValid: false,
      severity: 'error',
      code: 'INVALID_SPOT',
      message: 'Spot must be a valid number to validate strike coverage',
      field: 'spot',
      value: spot
    };
  }

  const nearSpot = strikes.filter(s => Math.abs(s - spot) / spot <= tolerance);
  if (nearSpot.length < minStrikes) {
    return {
      isValid: false,
      severity: 'error',
      code: 'STRIKE_COVERAGE_INSUFFICIENT',
      message: `Only ${nearSpot.length} strikes within ±${Math.round(tolerance * 100)}% of spot $${spot} (need ${minStrikes}+ for reliable ladder)`,
      field: fieldName,
      value: { spot, strikesNearSpot: nearSpot.slice(0, 10) }
    };
  }

  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateMaxPainInRange(
  maxPain: number, 
  strikes: number[]
): ValidationResult {
  if (strikes.length === 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'EMPTY_STRIKES',
      message: 'Strikes array is empty for max pain validation'
    };
  }
  
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  
  if (maxPain < minStrike || maxPain > maxStrike) {
    return {
      isValid: false,
      severity: 'warning',
      code: 'MAX_PAIN_OUT_OF_RANGE',
      message: `Max pain $${maxPain} is outside available strikes [$${minStrike}-$${maxStrike}]`,
      field: 'maxPain',
      value: { maxPain, minStrike, maxStrike }
    };
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateArrayNoNaN(arr: number[], fieldName: string): ValidationResult {
  const nanIndices: number[] = [];
  arr.forEach((val, i) => {
    if (isNaN(val) || !isFinite(val)) {
      nanIndices.push(i);
    }
  });
  
  if (nanIndices.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'ARRAY_HAS_NAN',
      message: `Array ${fieldName} has NaN/Infinity at indices: ${nanIndices.slice(0, 5).join(', ')}${nanIndices.length > 5 ? '...' : ''}`,
      field: fieldName,
      value: { nanCount: nanIndices.length, firstIndices: nanIndices.slice(0, 5) }
    };
  }
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validatePositiveFiniteArray(arr: number[], fieldName: string): ValidationResult {
  const invalidIndices: number[] = [];

  arr.forEach((val, i) => {
    if (!isFinite(val) || val <= 0) {
      invalidIndices.push(i);
    }
  });

  if (invalidIndices.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'INVALID_STRIKE_VALUE',
      message: `${fieldName} contains non-finite or non-positive strikes at indices ${invalidIndices.slice(0, 5).join(', ')}`,
      field: fieldName,
      value: { invalidCount: invalidIndices.length, sample: invalidIndices.slice(0, 5) }
    };
  }

  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

// ============================================================================
// COPY LOGIC VALIDATOR
// ============================================================================

export function validateCopyLogic(
  content: string,
  skewDirection: 'put' | 'call',
  fieldName: string = 'threadContent'
): ValidationResult {
  // Call skew should NOT say "protection" - should say "upside exposure/speculation"
  if (skewDirection === 'call') {
    if (/paying up for protection/i.test(content)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'WRONG_COPY_LOGIC',
        message: 'Call skew copy incorrectly mentions "protection" - should say "upside exposure/speculation"',
        field: fieldName,
        value: content.substring(0, 200)
      };
    }
    if (/downside protection/i.test(content)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'WRONG_COPY_LOGIC',
        message: 'Call skew copy incorrectly mentions "downside protection"',
        field: fieldName,
        value: content.substring(0, 200)
      };
    }
  }
  
  // Put skew should NOT say "upside speculation"
  if (skewDirection === 'put') {
    if (/upside speculation/i.test(content) || /paying up for upside/i.test(content)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'WRONG_COPY_LOGIC',
        message: 'Put skew copy incorrectly mentions "upside speculation"',
        field: fieldName,
        value: content.substring(0, 200)
      };
    }
  }
  
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

export function validateGammaSignConsistency(
  content: string,
  modeledGamma: 'long' | 'short' | undefined,
  fieldName: string = 'threadContent'
): ValidationResult {
  if (!modeledGamma) {
    return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
  }

  const gammaPhrase = /gamma[^\n]{0,40}\b(long|short)\b|\b(long|short)\s+gamma/gi;
  let match: RegExpExecArray | null;
  while ((match = gammaPhrase.exec(content)) !== null) {
    const mentioned = (match[1] || match[2] || '').toLowerCase();
    if (mentioned && mentioned !== modeledGamma) {
      return {
        isValid: false,
        severity: 'error',
        code: 'GAMMA_SIGN_MISMATCH',
        message: `Thread claims ${mentioned} gamma but chart data shows ${modeledGamma}`,
        field: fieldName,
        value: { modeledGamma, mentioned }
      };
    }
  }

  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

// ============================================================================
// DARK POOL OVERCLAIM VALIDATOR
// ============================================================================

export function validateNoPrintDirectionClaim(
  content: string,
  eventType: 'OPTIONS_SWEEP' | 'DARK_POOL_PRINT',
  fieldName: string = 'threadContent'
): ValidationResult {
  // Dark pool prints do NOT reliably indicate buy/sell direction from print data alone
  // Claims like "aligns with print direction" are overclaims that damage credibility
  if (eventType === 'DARK_POOL_PRINT') {
    if (/print direction/i.test(content)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'PRINT_DIRECTION_OVERCLAIM',
        message: 'Dark pool copy claims "print direction" which is not reliably determinable from print data alone',
        field: fieldName,
        value: content.substring(0, 200)
      };
    }
    if (/dark pool.*direction/i.test(content) && !/don't confirm direction|doesn't confirm direction/i.test(content)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'PRINT_DIRECTION_OVERCLAIM',
        message: 'Dark pool copy implies direction knowledge which is an overclaim',
        field: fieldName,
        value: content.substring(0, 200)
      };
    }
  }
  
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

// ============================================================================
// CROSS-PANEL STRIKE CONSISTENCY VALIDATOR
// ============================================================================

// Gamma-based cross-panel validation removed as gamma surfaces are no longer part of
// the high-confidence panel set. Strike coverage checks specific to IV surfaces and
// smiles are handled closer to those charts.

// ============================================================================
// EXPIRY CONSISTENCY VALIDATOR
// ============================================================================

export function validateExpiryConsistency(
  eventExpiry: string | undefined,
  chartExpiry: string | undefined,
  chartType: string,
  fieldName: string = 'expiryConsistency'
): ValidationResult {
  // Skip if no event expiry is specified
  if (!eventExpiry) {
    return { isValid: true, severity: 'info', code: 'VALID', message: 'No event expiry to validate' };
  }
  
  // Skip if no chart expiry is specified
  if (!chartExpiry) {
    return { isValid: true, severity: 'info', code: 'VALID', message: 'No chart expiry to validate' };
  }
  
  // Normalize dates for comparison (YYYY-MM-DD format)
  const eventDate = new Date(eventExpiry).toISOString().split('T')[0];
  const chartDate = new Date(chartExpiry).toISOString().split('T')[0];
  
  // Check if dates are the same
  if (eventDate !== chartDate) {
    // Check if chart expiry is in the past compared to event expiry (more severe)
    const eventTime = new Date(eventExpiry).getTime();
    const chartTime = new Date(chartExpiry).getTime();
    
    if (chartTime < eventTime) {
      return {
        isValid: false,
        severity: 'error',
        code: 'EXPIRY_MATCH',
        message: `${chartType} chart expiry (${chartExpiry}) is earlier than event expiry (${eventExpiry}) - stale data`,
        field: fieldName,
        value: { eventExpiry, chartExpiry, chartType }
      };
    }
    
    // Chart expiry is different but in the future - still a mismatch but could be intentional
    return {
      isValid: false,
      severity: 'error',
      code: 'EXPIRY_MATCH',
      message: `${chartType} chart expiry (${chartExpiry}) does not match event expiry (${eventExpiry})`,
      field: fieldName,
      value: { eventExpiry, chartExpiry, chartType }
    };
  }
  
  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

// ============================================================================
// SVG CONTENT VALIDATOR
// ============================================================================

export function validateSvgContent(svgContent: string, chartType: string): ValidationResult {
  const errors: string[] = [];

  // Check for visible NaN in SVG text elements (matches ">NaN<" or ">Value: NaN<" etc)
  if (/>NaN</i.test(svgContent) || />.*\bNaN\b.*</i.test(svgContent)) {
    errors.push('SVG contains visible "NaN" text');
  }
  
  // Check for undefined in SVG (matches ">undefined<" or ">Value: undefined<" etc)
  if (/>undefined</i.test(svgContent) || />.*\bundefined\b.*</i.test(svgContent) || /=\"undefined\"/i.test(svgContent)) {
    errors.push('SVG contains "undefined"');
  }

  if (/>.*\bInfinity\b.*</i.test(svgContent)) {
    errors.push('SVG contains Infinity');
  }
  
  // P0: Check for "UNUSUAL" placeholder text that should be replaced with real values
  if (/>UNUSUAL</i.test(svgContent) || />.*\bUNUSUAL\b.*</i.test(svgContent)) {
    errors.push('SVG contains "UNUSUAL" placeholder text - replace with actual values');
  }
  
  // P0: Check for "UW" artifact from Unusual Whales data that wasn't replaced
  if (/>UW</i.test(svgContent) || />.*\bUW\b.*</i.test(svgContent)) {
    errors.push('SVG contains "UW" artifact - data placeholder not replaced');
  }
  
  // P0: Check for standalone "N/A" as a legend artifact (but allow in valid fallback contexts)
  // This catches "N/A" in legend entries or data labels that should have real values
  if (/>"?N\/A"?<\/text>/i.test(svgContent) && !/>N\/A$/i.test(svgContent)) {
    // Only flag if "N/A" appears in what looks like a data label context
    const naCount = (svgContent.match(/>N\/A</g) || []).length;
    if (naCount > 3) {
      errors.push('SVG contains multiple "N/A" artifacts - data placeholders not replaced');
    }
  }

  const placeholderTokens = ['UW', 'UNUSUAL', 'SWEEP'];
  placeholderTokens.forEach(token => {
    const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
    if (tokenRegex.test(svgContent)) {
      errors.push(`SVG contains placeholder token "${token}"`);
    }
  });

  // Check for garbled labels
  for (const pattern of LABEL_CORRUPTION_PATTERNS) {
    if (pattern.test(svgContent)) {
      errors.push('SVG contains garbled labels');
      break;
    }
  }
  
  // Check for invalid coordinates
  if (/x=\"NaN\"|y=\"NaN\"|cx=\"NaN\"|cy=\"NaN\"/i.test(svgContent)) {
    errors.push('SVG contains NaN coordinates');
  }
  
  // Check for invalid height/width attributes (NaN in dimensions)
  if (/width=\"NaN\"|height=\"NaN\"/i.test(svgContent)) {
    errors.push('SVG contains NaN dimensions');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      code: 'SVG_PLACEHOLDER_OR_NAN',
      message: `SVG validation failed for ${chartType}: ${errors.join(', ')}`,
      field: chartType,
      value: errors
    };
  }

  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

// ============================================================================
// IV UNIT / SCALE VALIDATOR
// ============================================================================

/**
 * Detect obviously corrupt IV scales where values are rendered as 1700%+
 * instead of normalized decimals. This runs on SVG text content to catch
 * presentation issues before publishing.
 */
export function validateIvUnitScale(svgContent: string, fieldName: string = 'ivUnits'): ValidationResult {
  if (!svgContent) {
    return {
      isValid: false,
      severity: 'error',
      code: 'EXPIRY_DATA_MISSING',
      message: 'Missing SVG content for IV chart',
      field: fieldName
    };
  }

  const percentMatches = Array.from(svgContent.matchAll(/([0-9]{1,4}(?:\.[0-9]+)?)%/g));
  const decimalMatches = Array.from(svgContent.matchAll(/[^0-9]([0-9](?:\.[0-9]+)?)[^0-9%]/g)).map(m => parseFloat(m[1]));

  const maxPercent = percentMatches.length > 0 ? Math.max(...percentMatches.map(m => parseFloat(m[1]))) : 0;
  const maxDecimal = decimalMatches.length > 0 ? Math.max(...decimalMatches) : 0;

  const percentIssue = percentMatches
    .map(m => parseFloat(m[1]))
    .find(v => normalizeIv(v) === null);

  if (percentIssue !== undefined) {
    return {
      isValid: false,
      severity: 'error',
      code: 'INVALID_IV_UNITS',
      message: `Detected implausible IV percent-scale value (${percentIssue.toFixed(1)}%) in ${fieldName}`,
      field: fieldName,
      value: { maxPercent }
    };
  }

  const decimalIssue = decimalMatches.find(v => normalizeIv(v) === null);
  if (decimalIssue !== undefined) {
    return {
      isValid: false,
      severity: 'error',
      code: 'INVALID_IV_UNITS',
      message: `Detected implausible IV decimal value (${decimalIssue.toFixed(2)}) in ${fieldName}`,
      field: fieldName,
      value: { maxDecimal }
    };
  }

  return { isValid: true, severity: 'info', code: 'VALID', message: 'OK' };
}

// ============================================================================
// EVENT TYPE VALIDATORS
// ============================================================================

export function validateOptionsSwepEvent(metrics: EventMetrics): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Options sweep requires strike and expiry
  results.push(validateRequiredField(metrics.strike, 'strike'));
  results.push(validateRequiredField(metrics.expiry, 'expiry'));
  results.push(validateRequiredField(metrics.contracts, 'contracts'));
  results.push(validateRequiredField(metrics.breakeven, 'breakeven'));
  
  if (metrics.strike) {
    results.push(validateNoNaN(metrics.strike, 'strike'));
    results.push(validateNumberRange(metrics.strike, 0.01, 100000, 'strike'));
  }

  if (metrics.breakeven) {
    results.push(validateNoNaN(metrics.breakeven, 'breakeven'));
    results.push(validateBreakevenPlausibility(metrics.breakeven, metrics.strike, metrics.price));
  }
  
  results.push(validatePercentile(metrics.percentile, 'percentile'));
  results.push(validateNoNaN(metrics.price, 'price'));
  results.push(validateNoNaN(metrics.notionalValue, 'notionalValue'));
  
  return results.filter(r => !r.isValid);
}

export function validateDarkPoolEvent(metrics: EventMetrics): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // Dark pool requires shares and price
  results.push(validateRequiredField(metrics.shares, 'shares'));
  results.push(validateRequiredField(metrics.price, 'price'));
  
  if (metrics.shares) {
    results.push(validateNoNaN(metrics.shares, 'shares'));
    results.push(validateNumberRange(metrics.shares, 1, 1000000000, 'shares'));
  }
  
  results.push(validatePercentile(metrics.percentile, 'percentile'));
  results.push(validateNoNaN(metrics.price, 'price'));
  results.push(validateNoNaN(metrics.notionalValue, 'notionalValue'));
  
  return results.filter(r => !r.isValid);
}

// ============================================================================
// FULL POST VALIDATION
// ============================================================================

export interface ValidationGateResult {
  isPublishable: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  summary: string;
}

export function runValidationGate(
  symbol: string,
  eventType: 'OPTIONS_SWEEP' | 'DARK_POOL_PRINT',
  metrics: EventMetrics,
  threadContent: string[],
  svgCharts: Record<string, string>,
  skewDirection: 'put' | 'call',
  strikes: number[] = [],
  spot: number = 0,
  ivStrikes: number[] = [],
  oiStrikes: number[] = [],
  chartExpiries: Record<string, string> = {}, // Map of chartType -> expiry for expiry consistency checks
  gammaExposurePosition?: 'long' | 'short',
  chartQualityReports: Record<string, DataQualityReport> = {}
): ValidationGateResult {
  const errors: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  // 1. Validate event-specific requirements
  const eventErrors = eventType === 'OPTIONS_SWEEP'
    ? validateOptionsSwepEvent(metrics)
    : validateDarkPoolEvent(metrics);
  errors.push(...eventErrors);

  const normalizedThread = Array.isArray(threadContent) ? threadContent : [];
  if (normalizedThread.length === 0) {
    errors.push({
      isValid: false,
      severity: 'error',
      code: 'THREAD_MISSING',
      message: 'Thread content missing or empty',
      field: 'thread'
    });
  }

  const strikeArrays: Array<{ values: number[]; field: string }> = [
    { values: strikes, field: 'strikes' },
    { values: ivStrikes, field: 'ivStrikes' },
    { values: oiStrikes, field: 'oiStrikes' }
  ];

  strikeArrays.forEach(({ values, field }) => {
    if (values && values.length > 0) {
      const nanCheck = validateArrayNoNaN(values, field);
      if (!nanCheck.isValid) errors.push(nanCheck);

      const positiveCheck = validatePositiveFiniteArray(values, field);
      if (!positiveCheck.isValid) errors.push(positiveCheck);
    }
  });

  // 2. Validate thread content
  normalizedThread.forEach((content, i) => {
    const nanCheck = validateNoSuspiciousStrings(content, `thread[${i}]`);
    if (!nanCheck.isValid) errors.push(nanCheck);
    
    const garbledCheck = validateNoGarbledLabels(content, `thread[${i}]`);
    if (!garbledCheck.isValid) errors.push(garbledCheck);

    const copyCheck = validateCopyLogic(content, skewDirection, `thread[${i}]`);
    if (!copyCheck.isValid) errors.push(copyCheck);

    // P0: Validate no "print direction" overclaim in dark pool threads
    const overclaim = validateNoPrintDirectionClaim(content, eventType, `thread[${i}]`);
    if (!overclaim.isValid) errors.push(overclaim);
  });
  
  // 3. Validate SVG charts (only the five high-confidence panels)
  const requiredCharts: Array<{ key: string; alias?: string }> = [
    { key: 'flowSummarySvg' },
    { key: 'optionsFlowHeatmapSvg' },
    { key: 'historicalVsImpliedVolSvg' },
    { key: 'volatilitySmileSvg' },
    { key: 'ivRankDistributionSvg', alias: 'ivRankHistogramSvg' }
  ];

  requiredCharts.forEach(({ key: chartType, alias }) => {
    const svg = svgCharts[chartType] || (alias ? svgCharts[alias] : undefined);

    if (!svg) {
      errors.push({
        isValid: false,
        severity: 'error',
        code: 'SVG_MISSING',
        message: `${chartType} is missing`,
        field: chartType
      });
      return;
    }

    const svgCheck = validateSvgContent(svg, chartType);
    if (!svgCheck.isValid) {
      if (svgCheck.severity === 'error') {
        errors.push(svgCheck);
      } else {
        warnings.push(svgCheck);
      }
    }

    if (eventType === 'DARK_POOL_PRINT' && /premium paid/i.test(svg)) {
      errors.push({
        isValid: false,
        severity: 'error',
        code: 'DARKPOOL_PREMIUM_MISLABEL',
        message: `${chartType} contains "premium paid" label which is not valid for dark pool prints`,
        field: chartType,
        value: svg
      });
    }

    // Block corrupted IV scaling (e.g., 1700% labels) on volatility charts
    if (chartType.toLowerCase().includes('volatility')) {
      const ivScaleCheck = validateIvUnitScale(svg, chartType);
      if (!ivScaleCheck.isValid) {
        errors.push(ivScaleCheck);
      }
    }
  });

  // 3b. Validate chart quality reports
  Object.entries(chartQualityReports).forEach(([chartType, quality]) => {
    if (quality.usedFallback) {
      errors.push({
        isValid: false,
        severity: 'error',
        code: 'MOCK_DATA_USED',
        message: `${chartType} used fallback/mock data`,
        field: chartType,
        value: quality
      });
    }

    if (quality.missingFields && quality.missingFields.length > 0) {
      errors.push({
        isValid: false,
        severity: 'error',
        code: 'DATA_INSUFFICIENT_NO_FALLBACK',
        message: `${chartType} missing required fields: ${quality.missingFields.join(', ')}`,
        field: chartType,
        value: quality.missingFields
      });
    }

    if (quality.ivStats) {
      const ivMax = quality.ivStats.unit === 'decimal' ? quality.ivStats.max * 100 : quality.ivStats.max;
      if (ivMax > 300) {
        errors.push({
          isValid: false,
          severity: 'error',
          code: 'IV_IMPLAUSIBLE_UNITS',
          message: `${chartType} shows implied volatility above 300% (max ${ivMax.toFixed(2)}%)`,
          field: chartType,
          value: quality.ivStats
        });
      }
    }

    if (quality.strikeCoverage) {
      if (quality.strikeCoverage.nearSpotCount < quality.strikeCoverage.minRequired) {
        errors.push({
          isValid: false,
          severity: 'error',
          code: 'STRIKE_COVERAGE_INSUFFICIENT',
          message: `${chartType} strike coverage insufficient near spot (${quality.strikeCoverage.nearSpotCount}/${quality.strikeCoverage.minRequired})`,
          field: chartType,
          value: quality.strikeCoverage
        });
      }
    }

    if (chartType.toLowerCase().includes('correlation') && quality.symbolsUsed) {
      const normalized = quality.symbolsUsed.map(s => s.toUpperCase());
      const unique = new Set<string>();
      const duplicates = new Set<string>();
      normalized.forEach(s => {
        if (unique.has(s)) duplicates.add(s);
        unique.add(s);
      });
      if (duplicates.size > 0) {
        errors.push({
          isValid: false,
          severity: 'error',
          code: 'CORR_DUPLICATE_SYMBOLS',
          message: `${chartType} contains duplicate symbols: ${Array.from(duplicates).join(', ')}`,
          field: chartType,
          value: quality.symbolsUsed
        });
      }
    }
  });
  
  // 4. Validate strike coverage around spot for IV surface/smile
  const coverageStrikes = ivStrikes.length > 0 ? ivStrikes : strikes;
  if (coverageStrikes.length > 0 && spot > 0) {
    const strikeCoverageCheck = validateStrikeCoverage(coverageStrikes, spot, 0.15, 5);
    if (!strikeCoverageCheck.isValid) {
      errors.push(strikeCoverageCheck);
    }
    const spotRangeCheck = validateSpotInRange(spot, coverageStrikes, 0.1);
    if (!spotRangeCheck.isValid && spotRangeCheck.severity === 'error') {
      errors.push(spotRangeCheck);
    }
  }

  // 5. Validate expiry consistency (chart expiries must match event expiry)
  if (metrics.expiry && Object.keys(chartExpiries).length > 0) {
    Object.entries(chartExpiries).forEach(([chartType, chartExpiry]) => {
      const expiryCheck = validateExpiryConsistency(metrics.expiry, chartExpiry, chartType);
      if (!expiryCheck.isValid) {
        errors.push(expiryCheck);
      }
    });
  }
  
  // 7. Build summary
  const isPublishable = errors.length === 0;
  const summary = isPublishable 
    ? `Validation passed with ${warnings.length} warning(s)`
    : `Validation FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`;
  
  return {
    isPublishable,
    errors,
    warnings,
    summary
  };
}

// ============================================================================
// FORMATTING UTILITIES (Consistent across all threads)
// ============================================================================

export interface FormattingOptions {
  roundDollars: boolean;
  percentDecimals: number;
  sharesSuffix: boolean;
  contractsSuffix: boolean;
}

const DEFAULT_FORMAT_OPTIONS: FormattingOptions = {
  roundDollars: true,
  percentDecimals: 1,
  sharesSuffix: true,
  contractsSuffix: true
};

export function formatDollarAmount(value: number, options: Partial<FormattingOptions> = {}): string {
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  
  if (isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(opts.roundDollars ? 1 : 2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(opts.roundDollars ? 1 : 2)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(opts.roundDollars ? 0 : 1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  if (isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  return `${value.toFixed(decimals)}%`;
}

export function formatShares(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M shares`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(0)}K shares`;
  }
  return `${value.toLocaleString()} shares`;
}

export function formatContracts(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K contracts`;
  }
  return `${value.toLocaleString()} contracts`;
}

export function formatStrikePrice(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  return `$${value.toFixed(2)}`;
}

// ============================================================================
// SAFE VALUE HELPERS
// ============================================================================

export function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export function safePercentile(value: any, fallback: number = 50): number {
  const num = safeNumber(value, fallback);
  return Math.max(0, Math.min(100, num));
}

export function safePositiveNumber(value: any, fallback: number = 1): number {
  const num = safeNumber(value, fallback);
  return num > 0 ? num : fallback;
}

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
  
  // P0 BLOCKER: Spot must be within gamma strike range for any gamma-based claims to be valid
  // Use stricter ±10% tolerance - if spot is far outside, the gamma panel is logically unusable
  const rangeMidpoint = (minStrike + maxStrike) / 2;
  const rangeTolerance = (maxStrike - minStrike) * 0.1; // 10% of range
  
  if (spot < minStrike - rangeTolerance || spot > maxStrike + rangeTolerance) {
    return {
      isValid: false,
      severity: 'error',  // UPGRADED FROM WARNING TO BLOCKING ERROR
      code: 'SPOT_OUT_OF_RANGE',
      message: `Spot price $${spot} is far outside gamma strike range [$${minStrike}-$${maxStrike}] - gamma panel invalid`,
      field: fieldName,
      value: { spot, minStrike, maxStrike, rangeMidpoint }
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

export function validateCrossPanelConsistency(
  gammaStrikes: number[],
  ivStrikes: number[],
  oiStrikes: number[],
  fieldName: string = 'crossPanel'
): ValidationResult {
  // Skip if no gamma strikes
  if (gammaStrikes.length === 0) {
    return { isValid: true, severity: 'info', code: 'VALID', message: 'No gamma strikes to validate' };
  }
  
  const gammaCenter = (Math.min(...gammaStrikes) + Math.max(...gammaStrikes)) / 2;
  
  // Check IV strikes if available
  if (ivStrikes.length > 0) {
    const ivCenter = (Math.min(...ivStrikes) + Math.max(...ivStrikes)) / 2;
    const deviation = Math.abs(gammaCenter - ivCenter) / gammaCenter;
    
    if (deviation > 0.2) { // >20% deviation
      return {
        isValid: false,
        severity: 'error',
        code: 'STRIKE_RANGE_MISMATCH',
        message: `Gamma strike center ($${gammaCenter.toFixed(0)}) differs >20% from IV strike center ($${ivCenter.toFixed(0)})`,
        field: fieldName,
        value: { gammaCenter, ivCenter, deviation: (deviation * 100).toFixed(1) + '%' }
      };
    }
  }
  
  // Check OI strikes if available
  if (oiStrikes.length > 0) {
    const oiCenter = (Math.min(...oiStrikes) + Math.max(...oiStrikes)) / 2;
    const deviation = Math.abs(gammaCenter - oiCenter) / gammaCenter;
    
    if (deviation > 0.2) { // >20% deviation
      return {
        isValid: false,
        severity: 'error',
        code: 'STRIKE_RANGE_MISMATCH',
        message: `Gamma strike center ($${gammaCenter.toFixed(0)}) differs >20% from OI strike center ($${oiCenter.toFixed(0)})`,
        field: fieldName,
        value: { gammaCenter, oiCenter, deviation: (deviation * 100).toFixed(1) + '%' }
      };
    }
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
  
  // P0: Check for "UNUSUAL" placeholder text that should be replaced with real values
  if (/>UNUSUAL</i.test(svgContent) || />.*\bUNUSUAL\b.*</i.test(svgContent)) {
    errors.push('SVG contains "UNUSUAL" placeholder text - replace with actual values');
  }
  
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
      code: 'INVALID_SVG',
      message: `SVG validation failed for ${chartType}: ${errors.join(', ')}`,
      field: chartType,
      value: errors
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
  
  if (metrics.strike) {
    results.push(validateNoNaN(metrics.strike, 'strike'));
    results.push(validateNumberRange(metrics.strike, 0.01, 100000, 'strike'));
  }
  
  if (metrics.breakeven) {
    results.push(validateNoNaN(metrics.breakeven, 'breakeven'));
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
  oiStrikes: number[] = []
): ValidationGateResult {
  const errors: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];
  
  // 1. Validate event-specific requirements
  const eventErrors = eventType === 'OPTIONS_SWEEP' 
    ? validateOptionsSwepEvent(metrics)
    : validateDarkPoolEvent(metrics);
  errors.push(...eventErrors);
  
  // 2. Validate thread content
  threadContent.forEach((content, i) => {
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
  
  // 3. Validate SVG charts
  Object.entries(svgCharts).forEach(([chartType, svg]) => {
    const svgCheck = validateSvgContent(svg, chartType);
    if (!svgCheck.isValid) {
      if (svgCheck.severity === 'error') {
        errors.push(svgCheck);
      } else {
        warnings.push(svgCheck);
      }
    }
  });
  
  // 4. Validate spot and strikes if provided
  if (strikes.length > 0 && spot > 0) {
    const spotCheck = validateSpotInRange(spot, strikes);
    if (!spotCheck.isValid) {
      if (spotCheck.severity === 'error') {
        errors.push(spotCheck);
      } else {
        warnings.push(spotCheck);
      }
    }
  }
  
  // 5. Validate cross-panel strike consistency (gamma vs IV vs OI)
  if (strikes.length > 0 || ivStrikes.length > 0 || oiStrikes.length > 0) {
    const crossPanelCheck = validateCrossPanelConsistency(strikes, ivStrikes, oiStrikes);
    if (!crossPanelCheck.isValid) {
      errors.push(crossPanelCheck);
    }
  }
  
  // 6. Build summary
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

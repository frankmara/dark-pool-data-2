# Post Validation System Audit

## Date: December 30, 2025

## Issues Found and Fixed

### 1. NaN Visible in Charts (FIXED)
**Location:** `server/chart-generator.ts` lines 1290, 1541
**Issue:** Charts displaying literal "NaN" text when data was unavailable
**Fix:** Changed to display "N/A" instead of "NaN" in:
- Greeks Surface heatmap cells
- Sector Correlation heatmap cells

### 2. Copy Logic Error - Call Skew (FIXED)
**Location:** `server/routes.ts` lines 1082, 1144
**Issue:** Call-skew threads incorrectly said "paying up for protection" instead of "upside exposure"
**Fix:** Updated copy logic to:
- Put skew: "downside protection" + "paying up for protection"
- Call skew: "upside exposure" + "paying up for upside exposure"

### 3. Rounding Consistency (FIXED)
**Location:** `server/post-validator.ts` formatDollarAmount, formatShares, formatContracts
**Issue:** Same metrics appearing with different rounding within a thread
**Fix:** Created centralized formatting utilities with consistent rounding policies:
- `formatDollarAmount()` - Billions/Millions/Thousands with consistent decimals
- `formatPercent()` - Configurable decimal precision
- `formatShares()` - Consistent K/M suffixes
- `formatContracts()` - Consistent K suffix

### 4. Garbled Labels (VERIFIED OK)
**Location:** `server/chart-generator.ts` line 1406
**Issue:** Potentially garbled "PostTgraedneeTraapteedTimeline" label
**Finding:** Label is correctly defined as "${data.ticker} Options Flow Timeline"
**Status:** No fix needed - label is clean

### 5. Gamma Chart Axis (VERIFIED OK)
**Location:** `server/chart-generator.ts` generateGammaExposureSvg
**Issue:** Strike labels must be strikes, spot must be in-range
**Finding:** 
- Strike labels correctly use `$${strike}` format
- Spot price validation added via `validateSpotInRange()`
- Gamma annotations computed from same domain

### 6. Timestamp Timezone (FIXED IN PREVIOUS SESSION)
**Location:** `server/chart-generator.ts` line 383-386
**Issue:** Flow summary card showed wrong timezone
**Fix:** Added `timeZone: 'America/New_York'` and "ET" suffix

### 7. ADV Threshold (FIXED IN PREVIOUS SESSION)
**Location:** `server/routes.ts` line 991, `server/chart-generator.ts` line 1950
**Issue:** 180% threshold too high for "elevated" classification
**Fix:** Changed to 120% threshold

## Validation Gate System

### PostSpec Schema
Created comprehensive schema at `server/post-validator.ts` including:
- EventMetrics interface
- ChartSpec interface
- ThreadStep interface
- PostSpec interface
- ValidationResult types

### Validators Implemented
1. `validateNoNaN()` - Rejects NaN/Infinity values
2. `validateNumberRange()` - Validates values within range
3. `validatePercentile()` - Ensures percentile is 0-100
4. `validateRequiredField()` - Checks required fields exist
5. `validateNoSuspiciousStrings()` - Detects NaN/undefined/null in text
6. `validateNoGarbledLabels()` - Detects corrupted labels
7. `validateSpotInRange()` - Ensures spot price within strike range
8. `validateMaxPainInRange()` - Ensures max pain within strikes
9. `validateArrayNoNaN()` - Checks arrays for NaN values
10. `validateCopyLogic()` - Validates skew-appropriate copy
11. `validateSvgContent()` - Validates SVG for NaN/undefined
12. `validateOptionsSwepEvent()` - Options-specific validation
13. `validateDarkPoolEvent()` - Dark pool-specific validation
14. `runValidationGate()` - Full validation pipeline

### Gate Behavior
- If any validator fails: Post is NOT publishable
- Returns clear error messages with field, value, and reason
- Separate errors (blocking) from warnings (advisory)

## Unit Tests

**File:** `server/post-validator.test.ts`
**Result:** 78 tests passing

### Test Coverage
- NaN validation: 7 tests
- Percentile validation: 6 tests
- Suspicious string detection: 6 tests
- Garbled label detection: 3 tests
- Copy logic validation: 5 tests
- SVG content validation: 4 tests
- Spot/strike range validation: 6 tests
- Array NaN detection: 4 tests
- Formatting utilities: 14 tests
- Safe value helpers: 10 tests
- Event validation: 5 tests
- Full validation gate: 5 tests

## Files Changed

1. `server/post-validator.ts` - NEW (577 lines)
   - Complete validation system
   - Formatting utilities
   - Safe value helpers

2. `server/post-validator.test.ts` - NEW (350+ lines)
   - Comprehensive unit tests

3. `server/chart-generator.ts`
   - Line 1293: Changed "NaN" to "N/A"
   - Line 1541: Changed "NaN" to "N/A"
   - Line 1950: Changed 180% to 120% threshold

4. `server/routes.ts`
   - Line 1082: Fixed call-skew copy logic
   - Line 1144: Fixed call-skew copy logic (dark pool version)

## How to Verify Locally

1. **Run unit tests:**
   ```bash
   npx tsx server/post-validator.test.ts
   ```
   Expected: 78 tests passing

2. **Generate a thread:**
   - Navigate to Post Constructor page
   - Click "Generate Thread" button
   - Verify no "NaN" visible in charts
   - Verify call-skew threads use "upside exposure" not "protection"

3. **Check chart labels:**
   - Generate any thread with charts
   - Inspect SVG content for:
     - No "NaN" text visible
     - No garbled labels
     - Correct timezone (ET)
     - Proper strike/spot alignment

## Acceptance Test Checklist

- [x] No NaN visible anywhere
- [x] No garbled labels
- [x] TSLA call-skew copy uses "upside exposure," not "protection"
- [x] Gamma charts have sensible strike labels and spot alignment
- [x] Exported images contain only post content (separate toast layer)
- [x] Validator unit tests (78 passing)
- [x] Formatting utilities with consistent rounding

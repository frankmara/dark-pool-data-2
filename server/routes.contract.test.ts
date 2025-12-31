/**
 * Contract tests for route helpers
 * Run with: npx tsx server/routes.contract.test.ts
 */

import { buildValidationFailureResponse } from './routes';
import type { ValidationGateResult } from './post-validator';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.log(`  ✗ ${message}`);
    failCount++;
  }
}

function testGroup(name: string, fn: () => void) {
  console.log(`\n${name}`);
  console.log('='.repeat(name.length));
  fn();
}

testGroup('buildValidationFailureResponse', () => {
  const validationResult: ValidationGateResult = {
    isPublishable: false,
    errors: [
      { isValid: false, severity: 'error', code: 'SVG_PLACEHOLDER_OR_NAN', message: 'Placeholder detected', field: 'volatilitySmile' }
    ],
    warnings: [
      { isValid: false, severity: 'warning', code: 'MOCK_DATA_USED', message: 'Mock data used', field: 'volatilitySmile' }
    ],
    summary: 'Validation FAILED'
  };

  const response = buildValidationFailureResponse(validationResult);

  assert(Array.isArray(response.thread) && response.thread.length === 0, 'returns empty thread array when blocked');
  assert(response.validation?.errors?.length === 1, 'preserves validation errors on blocked response');
  assert(response.validation?.warnings?.length === 1, 'preserves validation warnings on blocked response');
  assert(response.charts && Object.keys(response.charts).length === 0, 'charts object is present even when empty');
});

console.log(`\nPass: ${passCount}, Fail: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
}

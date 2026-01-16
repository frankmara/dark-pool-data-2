/**
 * Run with: npx tsx server/publish-gate.test.ts
 */
import { validateForPublish } from './publish-gate';
import { RunArtifacts } from './run-artifacts';

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

console.log('\nPublish gate');
console.log('============');

const artifacts: RunArtifacts = {
  runId: 'run_test',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  symbol: 'AAPL',
  postType: 'OPTIONS_SWEEP',
  inputs: {},
  sourcesUsed: { unusual_whales: true, polygon: false, fmp: false, alpha_vantage: false, sec_edgar: false },
  usedFallback: true,
  missingFields: ['OPTIONS_CHAIN'],
  provenance: {},
  rawPayloads: {},
  generatedThread: ['Sample thread'],
  charts: {},
  validation: { isPublishable: false, errors: [], warnings: [] },
};

const result = validateForPublish(artifacts);
assert(result.isPublishable === false, 'blocks publish when fallback/mock data was used');
assert(result.errors.some((error) => error.code === 'MOCK_DATA_USED'), 'returns MOCK_DATA_USED error');

if (failCount > 0) {
  console.error(`\n${failCount} test(s) failed.`);
  process.exit(1);
}

console.log(`\n${passCount} test(s) passed.`);

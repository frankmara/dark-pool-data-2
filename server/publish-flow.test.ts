/**
 * Run with: npx tsx server/publish-flow.test.ts
 */
import { createRun, writeArtifact, writeRawSnapshot, writeReport, RunArtifacts } from './run-artifacts';
import { validateForPublish } from './publish-gate';
import { publishThread } from './publish';

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

async function runTest() {
  console.log('\nPublish flow');
  console.log('============');

  const run = await createRun({ symbol: 'AAPL', postType: 'OPTIONS_SWEEP' });
  const snapshot = await writeRawSnapshot(run.runId, 'test_payload', { ok: true });

  const artifacts: RunArtifacts = {
    runId: run.runId,
    startedAt: run.startedAt,
    completedAt: new Date().toISOString(),
    symbol: 'AAPL',
    postType: 'OPTIONS_SWEEP',
    inputs: { symbol: 'AAPL', postType: 'OPTIONS_SWEEP' },
    sourcesUsed: { unusual_whales: true, polygon: true, fmp: false, alpha_vantage: false, sec_edgar: false },
    usedFallback: false,
    missingFields: [],
    provenance: {
      optionsChain: {
        source: 'polygon',
        payloadPath: snapshot.path,
        payloadHash: snapshot.sha256,
      },
    },
    rawPayloads: { test_payload: snapshot },
    generatedThread: ['1/1 Sample publish thread'],
    charts: {},
    validation: { isPublishable: true, errors: [], warnings: [] },
  };

  await writeArtifact(run.runId, 'run', artifacts);
  const validation = validateForPublish(artifacts);
  await writeReport(run.runId, { isPublishable: validation.isPublishable });

  assert(validation.isPublishable === true, 'validateForPublish allows publishable run');

  const publishResult = await publishThread({ runId: run.runId, dryRun: true });
  assert(publishResult.dryRun === true, 'dry-run publishes without network calls');
  assert(!!publishResult.payload?.parts?.length, 'dry-run returns payload parts');
}

runTest()
  .then(() => {
    if (failCount > 0) {
      console.error(`\n${failCount} test(s) failed.`);
      process.exit(1);
    }
    console.log(`\n${passCount} test(s) passed.`);
  })
  .catch((error) => {
    console.error('Publish flow test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });

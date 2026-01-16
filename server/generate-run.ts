import { fetchUnusualWhalesData } from './live-data-service';
import { createRun, createSnapshotter, writeArtifact, writeReport, RunArtifacts } from './run-artifacts';
import { generatePublishablePost } from './publishable-generator';
import { validateForPublish } from './publish-gate';

interface GenerateRunOptions {
  symbol?: string;
  runId?: string;
  postType?: 'options' | 'dark_pool';
}

export async function generateRun(options: GenerateRunOptions) {
  const run = await createRun({ runId: options.runId, symbol: options.symbol, postType: options.postType });
  const rawPayloads: Record<string, { path: string; sha256: string }> = {};
  const snapshotter = createSnapshotter(run.runId, rawPayloads);

  const liveData = await fetchUnusualWhalesData(snapshotter);
  const candidates = [
    ...liveData.options.map((o) => ({ type: 'options', data: o })),
    ...liveData.darkPool.map((d) => ({ type: 'dark_pool', data: d })),
  ];

  const filtered = options.symbol
    ? candidates.filter((c) => c.data.ticker?.toUpperCase() === options.symbol?.toUpperCase())
    : candidates;

  const selected = options.postType
    ? filtered.find((c) => c.type === options.postType)
    : filtered[0];

  if (!selected) {
    const missingFields = ['UNUSUAL_WHALES_EVENT'];
    const artifacts: RunArtifacts = {
      runId: run.runId,
      startedAt: run.startedAt,
      completedAt: new Date().toISOString(),
      symbol: options.symbol || 'UNKNOWN',
      postType: options.postType === 'dark_pool' ? 'DARK_POOL_PRINT' : 'OPTIONS_SWEEP',
      inputs: { symbol: options.symbol, postType: options.postType },
      sourcesUsed: { unusual_whales: false, polygon: false, fmp: false, alpha_vantage: false, sec_edgar: false },
      usedFallback: false,
      missingFields,
      provenance: {},
      rawPayloads,
      generatedThread: [],
      charts: {},
      validation: { isPublishable: false, errors: [{ code: 'NO_CANDIDATE', message: 'No live candidates available' }], warnings: [] },
    };

    await writeArtifact(run.runId, 'run', artifacts);
    const validation = validateForPublish(artifacts);
    const report = buildReport(artifacts, validation);
    await writeReport(run.runId, report);

    return { runId: run.runId, report, artifacts };
  }

  const generation = await generatePublishablePost(selected, {
    runId: run.runId,
    snapshotter,
    rawPayloads,
  });

  const artifacts: RunArtifacts = {
    runId: run.runId,
    startedAt: run.startedAt,
    completedAt: new Date().toISOString(),
    symbol: generation.post.symbol,
    postType: generation.post.postType,
    inputs: {
      symbol: generation.post.symbol,
      postType: generation.post.postType,
      source: 'unusual_whales',
    },
    sourcesUsed: generation.sourcesUsed,
    usedFallback: generation.usedFallback,
    missingFields: generation.missingFields,
    provenance: generation.provenance,
    rawPayloads,
    generatedThread: generation.post.thread,
    standaloneTweet: generation.post.standaloneTweet,
    charts: generation.post.charts,
    validation: {
      isPublishable: generation.post.validation.isPublishable,
      errors: generation.post.validation.errors.map((error) => ({ code: error.code, message: error.message })),
      warnings: generation.post.validation.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
      summary: generation.post.validation.summary,
    },
  };

  await writeArtifact(run.runId, 'run', artifacts);
  await writeArtifact(run.runId, 'thread', { parts: generation.post.thread });
  await writeArtifact(run.runId, 'charts', generation.post.charts);

  const publishValidation = validateForPublish(artifacts);
  const report = buildReport(artifacts, publishValidation);
  await writeReport(run.runId, report);

  return { runId: run.runId, report, artifacts };
}

function buildReport(artifacts: RunArtifacts, publishValidation: ReturnType<typeof validateForPublish>) {
  return {
    runId: artifacts.runId,
    startedAt: artifacts.startedAt,
    completedAt: artifacts.completedAt,
    symbol: artifacts.symbol,
    postType: artifacts.postType,
    sourcesUsed: artifacts.sourcesUsed,
    usedFallback: artifacts.usedFallback,
    missingFields: artifacts.missingFields,
    validationErrors: publishValidation.errors,
    isPublishable: publishValidation.isPublishable,
    payloadSnapshots: artifacts.rawPayloads,
    provenance: publishValidation.provenance,
  };
}

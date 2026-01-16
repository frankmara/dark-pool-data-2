import { generateRun } from '../server/generate-run';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = typeof args.symbol === 'string' ? args.symbol.toUpperCase() : undefined;
  const runId = typeof args.runId === 'string' ? args.runId : undefined;
  const postType = typeof args.postType === 'string' ? (args.postType as 'options' | 'dark_pool') : undefined;

  const result = await generateRun({ symbol, runId, postType });

  console.log(`Run ${result.runId} complete.`);
  console.log(`Report: runs/${result.runId}/report.json`);
  console.log(`Artifacts: runs/${result.runId}/artifacts`);
  console.log(`Publishable: ${result.report.isPublishable}`);

  if (!result.report.isPublishable) {
    console.log('Publish gate errors:');
    for (const error of result.report.validationErrors) {
      console.log(`- ${error.code}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error('Generation failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

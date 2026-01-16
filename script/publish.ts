import { publishThread } from '../server/publish';

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
  const runId = typeof args.runId === 'string' ? args.runId : undefined;
  const dryRun = args.dryRun === true || args.dryRun === 'true';

  if (!runId) {
    console.error('Missing --runId');
    process.exit(1);
  }

  const result = await publishThread({ runId, dryRun });

  console.log(`Publish result for run ${runId}`);
  console.log(`Publishable: ${result.isPublishable}`);

  if (result.errors?.length) {
    console.log('Publish gate errors:');
    for (const error of result.errors) {
      console.log(`- ${error.code}: ${error.message}`);
    }
  }

  if (result.dryRun && result.payload) {
    console.log('Dry-run payload saved to runs/<runId>/publish.json');
  }

  if (result.tweetIds?.length) {
    console.log(`Posted tweet IDs: ${result.tweetIds.join(', ')}`);
  }
}

main().catch((error) => {
  console.error('Publish failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

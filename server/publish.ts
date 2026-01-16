import { promises as fs } from 'fs';
import path from 'path';
import { loadRunArtifacts, writeArtifact } from './run-artifacts';
import { validateForPublish } from './publish-gate';
import { postThread } from './x-publisher';

interface PublishThreadOptions {
  runId: string;
  dryRun?: boolean;
}

interface PublishThreadResult {
  runId: string;
  dryRun: boolean;
  isPublishable: boolean;
  errors?: { code: string; message: string; field?: string }[];
  payload?: { parts: string[] };
  tweetIds?: string[];
}

export async function publishThread(options: PublishThreadOptions): Promise<PublishThreadResult> {
  const runArtifacts = await loadRunArtifacts(options.runId);
  const validation = validateForPublish(runArtifacts);

  const publishPath = path.resolve(process.cwd(), 'runs', options.runId, 'publish.json');

  if (await fileExists(publishPath)) {
    const existing = JSON.parse(await fs.readFile(publishPath, 'utf-8')) as PublishThreadResult;
    if (existing.tweetIds && existing.tweetIds.length > 0) {
      return existing;
    }
  }

  if (!validation.isPublishable) {
    const blocked: PublishThreadResult = {
      runId: options.runId,
      dryRun: !!options.dryRun,
      isPublishable: false,
      errors: validation.errors,
    };
    await writeArtifact(options.runId, 'publish', blocked);
    await fs.writeFile(publishPath, JSON.stringify(blocked, null, 2), 'utf-8');
    return blocked;
  }

  const payload = { parts: runArtifacts.generatedThread };

  if (options.dryRun) {
    const dryResult: PublishThreadResult = {
      runId: options.runId,
      dryRun: true,
      isPublishable: true,
      payload,
    };
    await writeArtifact(options.runId, 'publish', dryResult);
    await fs.writeFile(publishPath, JSON.stringify(dryResult, null, 2), 'utf-8');
    return dryResult;
  }

  const posted = await postThread(payload.parts, { runId: options.runId });
  const liveResult: PublishThreadResult = {
    runId: options.runId,
    dryRun: false,
    isPublishable: true,
    payload,
    tweetIds: posted.tweetIds,
  };
  await writeArtifact(options.runId, 'publish', liveResult);
  await fs.writeFile(publishPath, JSON.stringify(liveResult, null, 2), 'utf-8');
  return liveResult;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

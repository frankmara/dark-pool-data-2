import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface RunContext {
  runId?: string;
  symbol?: string;
  postType?: string;
}

export interface RunPaths {
  root: string;
  runDir: string;
  rawDir: string;
  artifactsDir: string;
}

export interface RunHandle {
  runId: string;
  startedAt: string;
  paths: RunPaths;
}

export interface SnapshotInfo {
  path: string;
  sha256: string;
}

export interface RunArtifacts {
  runId: string;
  startedAt: string;
  completedAt: string;
  symbol: string;
  postType: string;
  inputs: Record<string, unknown>;
  sourcesUsed: Record<string, boolean>;
  usedFallback: boolean;
  missingFields: string[];
  provenance: Record<string, ProvenanceEntry>;
  rawPayloads: Record<string, SnapshotInfo>;
  generatedThread: string[];
  standaloneTweet?: string;
  charts: Record<string, string>;
  validation?: {
    isPublishable: boolean;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
    summary?: string;
  };
}

export interface ProvenanceEntry {
  source: string;
  payloadPath?: string;
  payloadHash?: string;
  derivedFrom?: string[];
  notes?: string;
}

const RUNS_ROOT = path.resolve(process.cwd(), 'runs');

function makeRunId() {
  const suffix = crypto.randomBytes(3).toString('hex');
  return `run_${Date.now()}_${suffix}`;
}

export async function createRun(context: RunContext = {}): Promise<RunHandle> {
  const runId = context.runId || makeRunId();
  const runDir = path.join(RUNS_ROOT, runId);
  const rawDir = path.join(runDir, 'raw');
  const artifactsDir = path.join(runDir, 'artifacts');

  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(artifactsDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const inputs = {
    runId,
    startedAt,
    symbol: context.symbol,
    postType: context.postType,
  };

  await writeJson(path.join(runDir, 'inputs.json'), inputs);

  return {
    runId,
    startedAt,
    paths: {
      root: RUNS_ROOT,
      runDir,
      rawDir,
      artifactsDir,
    },
  };
}

export async function writeArtifact(runId: string, name: string, payload: unknown): Promise<SnapshotInfo> {
  const filePath = path.join(RUNS_ROOT, runId, 'artifacts', `${name}.json`);
  return writeJsonWithHash(filePath, payload);
}

export async function writeReport(runId: string, payload: unknown): Promise<SnapshotInfo> {
  const filePath = path.join(RUNS_ROOT, runId, 'report.json');
  return writeJsonWithHash(filePath, payload);
}

export async function writeRawSnapshot(runId: string, name: string, payload: unknown): Promise<SnapshotInfo> {
  const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filePath = path.join(RUNS_ROOT, runId, 'raw', `${safeName}.json`);
  return writeJsonWithHash(filePath, payload);
}

export async function loadRunArtifacts(runId: string): Promise<RunArtifacts> {
  const filePath = path.join(RUNS_ROOT, runId, 'artifacts', 'run.json');
  const contents = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(contents) as RunArtifacts;
}

export function createSnapshotter(runId: string, rawPayloads: Record<string, SnapshotInfo>) {
  return async (name: string, payload: unknown) => {
    const info = await writeRawSnapshot(runId, name, payload);
    rawPayloads[name] = info;
    return info;
  };
}

async function writeJson(filePath: string, payload: unknown) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

async function writeJsonWithHash(filePath: string, payload: unknown): Promise<SnapshotInfo> {
  const serialized = JSON.stringify(payload, null, 2);
  await fs.writeFile(filePath, serialized, 'utf-8');
  const sha256 = crypto.createHash('sha256').update(serialized).digest('hex');
  return { path: filePath, sha256 };
}

import { RunArtifacts, ProvenanceEntry } from './run-artifacts';

export interface PublishValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface PublishValidationResult {
  isPublishable: boolean;
  errors: PublishValidationError[];
  provenance: Record<string, ProvenanceEntry>;
}

const MISSING_FIELD_CODE_MAP: Record<string, string> = {
  OPTIONS_CHAIN: 'MISSING_OPTIONS_CHAIN',
  POLYGON_QUOTE: 'MISSING_POLYGON_QUOTE',
  VOLATILITY_SMILE: 'MISSING_VOLATILITY_SMILE',
  OI_LADDER: 'MISSING_OI_LADDER',
  IV_TERM_STRUCTURE: 'MISSING_IV_TERM_STRUCTURE',
  GAMMA_EXPOSURE: 'MISSING_GAMMA_EXPOSURE',
  UNUSUAL_WHALES_EVENT: 'MISSING_FLOW_EVENT',
};

export function validateForPublish(runArtifacts: RunArtifacts): PublishValidationResult {
  const errors: PublishValidationError[] = [];

  if (runArtifacts.usedFallback) {
    errors.push({
      code: 'MOCK_DATA_USED',
      message: 'Fallback/mock data was used during generation. Publishing is blocked.',
    });
  }

  const missingFields = runArtifacts.missingFields || [];
  for (const field of missingFields) {
    errors.push({
      code: MISSING_FIELD_CODE_MAP[field] || 'MISSING_REQUIRED_FIELD',
      message: `Required upstream data missing: ${field}`,
      field,
    });
  }

  if (!Array.isArray(runArtifacts.generatedThread) || runArtifacts.generatedThread.length === 0) {
    errors.push({
      code: 'THREAD_MISSING',
      message: 'Generated thread is empty or missing.',
      field: 'thread',
    });
  }

  const requiredPayloads = Object.values(runArtifacts.provenance || {}).filter(
    (entry) => entry.payloadPath && entry.payloadHash
  );

  if (requiredPayloads.length === 0) {
    errors.push({
      code: 'MISSING_RAW_PAYLOADS',
      message: 'No raw payload snapshots were recorded for this run.',
    });
  }

  return {
    isPublishable: errors.length === 0,
    errors,
    provenance: runArtifacts.provenance || {},
  };
}

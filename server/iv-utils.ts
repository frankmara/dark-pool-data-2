export function normalizeIv(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  const num = Number(raw);
  if (!isFinite(num)) return null;

  let iv = num;

  // Treat anything above 3.0 as a percent input that needs conversion.
  if (iv > 3) {
    iv = iv / 100;
  }

  if (iv <= 0 || iv > 3) return null;

  return iv;
}

export class IvNormalizationError extends Error {
  constructor(
    public readonly value: number,
    public readonly scale: 'percent' | 'decimal',
    message?: string
  ) {
    super(message || `Invalid IV value ${value} (${scale})`);
    this.name = 'IvNormalizationError';
  }
}

export function requireNormalizedIv(value: number, context: string): number {
  const normalized = normalizeIv(value);
  if (normalized === null) {
    const scale: 'percent' | 'decimal' = value > 3 ? 'percent' : 'decimal';
    throw new IvNormalizationError(value, scale, `Invalid IV for ${context}: ${value}`);
  }
  return normalized;
}

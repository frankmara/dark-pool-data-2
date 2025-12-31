interface IvNormalizationMeta {
  normalized: number | null;
  invalid: boolean;
}

function normalizeIvWithMeta(raw: number | null | undefined): IvNormalizationMeta {
  if (raw === null || raw === undefined) return { normalized: null, invalid: false };

  const num = Number(raw);
  if (!isFinite(num)) return { normalized: null, invalid: true };

  let iv = num;

  // Treat anything above 3.0 as a percent input that needs conversion.
  if (iv > 3) {
    iv = iv / 100;
  }

  if (iv <= 0) return { normalized: null, invalid: false };
  if (iv > 3) return { normalized: null, invalid: true };

  return { normalized: iv, invalid: false };
}

export function normalizeIv(raw: number | null | undefined): number | null {
  return normalizeIvWithMeta(raw).normalized;
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
  const { normalized } = normalizeIvWithMeta(value);
  if (normalized === null) {
    const scale: 'percent' | 'decimal' = value > 3 ? 'percent' : 'decimal';
    throw new IvNormalizationError(value, scale, `Invalid IV for ${context}: ${value}`);
  }
  return normalized;
}

export class SmileDataMissingError extends Error {
  constructor(public readonly minPoints: number, public readonly actualPoints: number) {
    super(`Volatility smile missing sufficient data (${actualPoints}/${minPoints})`);
    this.name = 'SmileDataMissingError';
  }
}

export function buildNormalizedSmilePoints(
  points: { strike: number; callIV?: number; putIV?: number }[],
  minPoints: number = 5
): { strike: number; iv: number }[] {
  const normalizedPoints: { strike: number; iv: number }[] = [];

  for (const point of points) {
    const callMeta = normalizeIvWithMeta(point.callIV ?? null);
    const putMeta = normalizeIvWithMeta(point.putIV ?? null);

    if (callMeta.invalid && point.callIV !== undefined && point.callIV !== null) {
      throw new IvNormalizationError(point.callIV, point.callIV > 3 ? 'percent' : 'decimal');
    }
    if (putMeta.invalid && point.putIV !== undefined && point.putIV !== null) {
      throw new IvNormalizationError(point.putIV, point.putIV > 3 ? 'percent' : 'decimal');
    }

    const iv = callMeta.normalized ?? putMeta.normalized;
    if (iv !== null) {
      normalizedPoints.push({ strike: point.strike, iv });
    }
  }

  if (normalizedPoints.length < minPoints) {
    throw new SmileDataMissingError(minPoints, normalizedPoints.length);
  }

  return normalizedPoints;
}

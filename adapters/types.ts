/**
 * Uniform contract every data-source adapter implements.
 *
 * Adapters NEVER throw to the caller and NEVER block the pipeline: on any
 * failure they return `status: "unavailable" | "error"` with `toVerify: true`
 * so the operator dashboard can flag the field for manual entry instead.
 */
export type SourceKey =
  | "catastro"
  | "flood"
  | "seismic"
  | "radon"
  | "energy"
  | "crime"
  | "amenities"
  | "urbanism"
  | "affectation"
  | "heritage"
  | "zbe"
  | "tax"
  | "market";

export type AdapterStatus = "ok" | "unavailable" | "error";

export interface AdapterResult<T> {
  source: SourceKey;
  status: AdapterStatus;
  /** Present when status === "ok". */
  data?: T;
  /** True when the value must be confirmed by a human before publishing. */
  toVerify: boolean;
  /** ISO timestamp of the fetch attempt (drives the source_cache TTL). */
  fetchedAt: string;
  /** Operator-facing explanation, e.g. why it fell back to manual. */
  note?: string;
}

export function ok<T>(
  source: SourceKey,
  data: T,
  opts: { toVerify?: boolean; note?: string } = {},
): AdapterResult<T> {
  return {
    source,
    status: "ok",
    data,
    toVerify: opts.toVerify ?? false,
    fetchedAt: new Date().toISOString(),
    note: opts.note,
  };
}

export function unavailable<T>(
  source: SourceKey,
  note: string,
): AdapterResult<T> {
  return {
    source,
    status: "unavailable",
    toVerify: true,
    fetchedAt: new Date().toISOString(),
    note,
  };
}

export function failed<T>(source: SourceKey, note: string): AdapterResult<T> {
  return {
    source,
    status: "error",
    toVerify: true,
    fetchedAt: new Date().toISOString(),
    note,
  };
}

/** fetch() with a hard timeout so a slow source can't stall the pipeline. */
export async function fetchWithTimeout(
  url: string,
  ms = 20000,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

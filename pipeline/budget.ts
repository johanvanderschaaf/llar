import { failed, type AdapterResult, type SourceKey } from "@/adapters/types";

/**
 * Time budget for one report generation.
 *
 * The pipeline runs inside a Server Action whose wall-clock limit is the page's
 * `maxDuration` (60s on /start). Each adapter has its own fetch timeout, but
 * chained retries and sequential stages used to add up to well over that limit,
 * and Vercel would kill the function mid-run. The budget gives every stage a
 * deadline measured from the start of the run, so the pipeline always finishes
 * (with some sources marked unavailable) instead of being killed.
 */
export interface Budget {
  /** Milliseconds since the run started. */
  elapsed(): number;
  /** Milliseconds left until `atMs` (measured from the start), never negative. */
  until(atMs: number): number;
}

export function createBudget(now: () => number = Date.now): Budget {
  const start = now();
  return {
    elapsed: () => now() - start,
    until: (atMs) => Math.max(0, atMs - (now() - start)),
  };
}

/**
 * Resolve with the adapter's result, or with a `failed` result once `ms` have
 * passed. The underlying request is not cancelled; its late result is ignored.
 * Also turns an unexpected rejection into a `failed` result, so one adapter
 * breaking the never-throw contract cannot crash the whole report.
 */
export function withDeadline<T>(
  source: SourceKey,
  promise: Promise<AdapterResult<T>>,
  ms: number,
): Promise<AdapterResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AdapterResult<T>>((resolve) => {
    timer = setTimeout(
      () =>
        resolve(
          failed<T>(source, `Timed out after ${Math.round(ms / 1000)}s (report time budget).`),
        ),
      ms,
    );
  });
  const guarded = promise.catch((e: unknown) =>
    failed<T>(source, `Unexpected error: ${(e as Error)?.message ?? String(e)}`),
  );
  return Promise.race([guarded, timeout]).finally(() => clearTimeout(timer));
}

/** Append how long a source took to its operator-facing note. */
export function withTiming<T>(
  result: AdapterResult<T>,
  ms: number,
): AdapterResult<T> {
  const t = `${(ms / 1000).toFixed(1)}s`;
  return { ...result, note: result.note ? `${result.note} [${t}]` : `[${t}]` };
}

/** Run an adapter call and record its duration in the note. */
export async function timed<T>(
  run: () => Promise<AdapterResult<T>>,
): Promise<AdapterResult<T>> {
  const t0 = Date.now();
  const result = await run();
  return withTiming(result, Date.now() - t0);
}

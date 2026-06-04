import type { Report } from "./report";
import type { SourceKey, AdapterStatus } from "@/adapters/types";

/** What the operator (or, later, the buyer) submits to start a report. */
export interface ReportInput {
  /** Raw address or cadastral reference as typed. */
  addressOrRef: string;
  /** Resolved/normalised cadastral reference, once known. */
  cadastralRef?: string;
  listingUrl?: string;
  askingPriceEur?: number;
  builtM2?: number;
  usableM2?: number;
  /** Buyer email (guest), captured on the public form for delivery/follow-up. */
  email?: string;
  /** Who initiated the report. */
  source?: "buyer" | "operator";
}

export type ReportStatus = "draft" | "in_review" | "published";

/**
 * A row in `reports`. `data` is the full render-ready Report object (the single
 * source of truth the renderer consumes); provenance lives in `report_sources`.
 */
export interface ReportRow {
  id: string;
  cadastral_ref: string | null;
  status: ReportStatus;
  input: ReportInput;
  data: Report;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/** A row in `report_sources` — one per (report, source) fetch attempt. */
export interface SourceRow {
  id: string;
  report_id: string;
  source: SourceKey;
  status: AdapterStatus | "manual";
  to_verify: boolean;
  payload: unknown;
  note: string | null;
  fetched_at: string;
}

/** A row in `source_cache` — keyed lookups cached by cadastral ref. */
export interface SourceCacheRow {
  source: SourceKey;
  cache_key: string;
  payload: unknown;
  fetched_at: string;
}

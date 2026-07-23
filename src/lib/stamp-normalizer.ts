// Normalization layer for Alegra's `POST /api/v1/invoices/stamp` endpoint.
//
// The raw API is not a reliable contract: the exact same business state
// (e.g. "invoice already submitted, awaiting AFIP response") can appear
// either as a `data[]` entry with `success: true`, or as an `error[]` entry
// with `code: 3246`, depending on timing/retries. `data` and `error` can
// also both be present in the same response, and an empty/malformed body
// can show up on infrastructure failures (e.g. `{ message: "Service
// Unavailable" }`).
//
// Nothing outside this module should read Alegra's raw `data`/`error`
// shape directly — everything should consume `NormalizedStampResult[]`.

export type StampStatus = "ACCEPTED" | "PROCESSING" | "FAILED" | "RETRY";

export interface NormalizedStampResult {
  id: string;
  status: StampStatus;
  message: string;
  code?: number;
  emissionStatus?: string;
}

export interface RawStampEntry {
  id: string | number;
  success?: boolean;
  code?: number;
  emissionStatus?: string;
  message?: string;
}

export interface RawStampResponse {
  data?: RawStampEntry[];
  error?: RawStampEntry[];
  message?: string;
  [key: string]: unknown;
}

// Higher rank wins when the same invoice id is reported more than once
// (e.g. present in both `data` and `error`) — the most optimistic signal is
// also the most authoritative one in Alegra's payloads.
const STATUS_RANK: Record<StampStatus, number> = {
  ACCEPTED: 3,
  PROCESSING: 2,
  RETRY: 1,
  FAILED: 0,
};

function classifyEntry(
  entry: RawStampEntry,
  source: "data" | "error",
): NormalizedStampResult {
  const id = String(entry.id);
  const code = entry.code;
  const emissionStatus = entry.emissionStatus;
  const message = entry.message || "";

  // Already submitted, waiting on the government entity — not a failure,
  // regardless of whether Alegra decided to put it in `data` or `error`.
  if (emissionStatus === "STAMPED_AND_WAITING_RESPONSE") {
    return {
      id,
      status: "PROCESSING",
      message: message || "Invoice submitted, awaiting AFIP response.",
      code,
      emissionStatus,
    };
  }

  // Duplicate/late stamp attempt on an invoice already in flight.
  if (code === 3246) {
    return {
      id,
      status: "PROCESSING",
      message: message || "Invoice already in the certification process.",
      code,
      emissionStatus,
    };
  }

  // Genuine AFIP/business validation failure (bad date, missing fields, etc).
  if (code === 3051) {
    return {
      id,
      status: "FAILED",
      message: message || "Invoice failed AFIP validation.",
      code,
      emissionStatus,
    };
  }

  if (
    source === "data" &&
    (entry.success === true || emissionStatus === "STAMPED_AND_ACCEPTED")
  ) {
    return {
      id,
      status: "ACCEPTED",
      message: message || "Invoice stamped and accepted.",
      code,
      emissionStatus,
    };
  }

  // Unrecognized error entry — treat conservatively as a real failure.
  if (source === "error") {
    return {
      id,
      status: "FAILED",
      message: message || `Stamping failed (code ${code ?? "unknown"}).`,
      code,
      emissionStatus,
    };
  }

  // Unrecognized data entry without an explicit success flag — it made it
  // into `data`, so treat it as accepted rather than discarding it.
  return {
    id,
    status: "ACCEPTED",
    message: message || "Invoice stamped.",
    code,
    emissionStatus,
  };
}

function upsertBest(
  byId: Map<string, NormalizedStampResult>,
  result: NormalizedStampResult,
) {
  const existing = byId.get(result.id);
  if (!existing || STATUS_RANK[result.status] > STATUS_RANK[existing.status]) {
    byId.set(result.id, result);
  }
}

/**
 * Normalizes a raw Alegra stamp response into one predictable result per
 * requested invoice id. Handles data-only, error-only, both-at-once, and
 * infrastructure-failure (missing/malformed body) shapes uniformly.
 */
export function normalizeStampResponse(
  response: RawStampResponse | null | undefined,
  requestedIds: Array<string | number>,
  httpStatus: number = 200,
): NormalizedStampResult[] {
  const ids = requestedIds.map(String);

  const dataEntries = Array.isArray(response?.data) ? response!.data! : [];
  const errorEntries = Array.isArray(response?.error) ? response!.error! : [];

  // No usable per-invoice data at all: infrastructure-level failure
  // (service unavailable, gateway error, unparsable body, etc). None of
  // these invoices were actually evaluated by Alegra, so every one of them
  // should be retried rather than marked as failed.
  if (dataEntries.length === 0 && errorEntries.length === 0) {
    const message =
      (typeof response?.message === "string" && response.message) ||
      `No result returned by Alegra (HTTP ${httpStatus}).`;

    return ids.map((id) => ({ id, status: "RETRY", message }));
  }

  const byId = new Map<string, NormalizedStampResult>();

  for (const entry of dataEntries) {
    upsertBest(byId, classifyEntry(entry, "data"));
  }
  for (const entry of errorEntries) {
    upsertBest(byId, classifyEntry(entry, "error"));
  }

  // Requested ids Alegra silently dropped from both arrays — outcome is
  // unknown, so it's safer to flag them for retry than to assume failure.
  for (const id of ids) {
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        status: "RETRY",
        message: "No result returned for this invoice; retry recommended.",
      });
    }
  }

  return ids.map((id) => byId.get(id)!);
}

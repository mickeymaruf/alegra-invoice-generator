"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  normalizeStampResponse,
  NormalizedStampResult,
  RawStampResponse,
} from "@/lib/stamp-normalizer";

// --- Type Definitions ---
export interface NumberTemplate {
  id: string;
  name?: string;
  prefix?: string;
  subDocumentType?: string;
}

export interface InvoiceItem {
  id: string;
  price?: number;
  quantity?: number;
  discount?: number;
  tax?: Record<string, unknown>[];
}

export interface AlegraInvoice {
  id: string | number;
  number?: string;
  numberTemplate?: {
    id?: string;
    fullNumber?: string;
  };
  client?: {
    id: string | number;
    name?: string;
  };
  warehouse?: {
    id: string | number;
  };
  items?: InvoiceItem[];
  [key: string]: unknown;
}

export interface GenerationManifestRow {
  originalInvoiceId: string;
  originalNumber: string;
  generatedInvoiceId: string;
  generatedNumber: string;
  clientId: string;
  clientName: string;
  status: "Success" | "Failed";
  error: string;
  generatedAt: string;
}

export interface StampManifestRow {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  status: "Success" | "Failed";
  emissionStatus: string;
  error: string;
  stampedAt: string;
}

// --- Helper Functions ---
async function getAuthHeader() {
  const cookieStore = await cookies();
  const email = cookieStore.get("alegra_email")?.value;
  const token = cookieStore.get("alegra_token")?.value;

  if (!email || !token) return null;
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

// --- Stamp API integration ---
// All stamping (both the standalone "Stamp" action and Phase 2 of
// recreateAsTypeC) goes through this single helper so the rest of the app
// never has to reason about Alegra's inconsistent `data`/`error` contract —
// see src/lib/stamp-normalizer.ts for why that's necessary.
const STAMP_ENDPOINT = "https://api.alegra.com/api/v1/invoices/stamp";
const STAMP_BATCH_SIZE = 10;
// Infrastructure failures (503s, unparsable bodies) are classified as RETRY
// by the normalizer — retry those a couple of times with backoff before
// giving up. Genuine validation failures (FAILED) are never retried.
const STAMP_RETRY_DELAYS_MS = [500, 1500];

async function fetchStampBatch(
  auth: string,
  ids: string[],
): Promise<{ status: number; body: RawStampResponse | null }> {
  try {
    const res = await fetch(STAMP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });

    let body: RawStampResponse | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    return { status: res.status, body };
  } catch (err: any) {
    // Network-level failure (DNS, timeout, connection reset). Represent it
    // the same way as a 503 so the normalizer routes it to RETRY.
    return {
      status: 0,
      body: {
        message: err?.message || "Network error calling Alegra stamp API",
      },
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stamps a set of invoice ids, batching in chunks of STAMP_BATCH_SIZE and
 * transparently retrying only the ids Alegra reports as infrastructure
 * failures. Returns one normalized result per requested id — callers never
 * touch the raw Alegra response.
 */
async function stampInvoiceIds(
  auth: string,
  ids: string[],
): Promise<Map<string, NormalizedStampResult>> {
  const resultsById = new Map<string, NormalizedStampResult>();

  for (let i = 0; i < ids.length; i += STAMP_BATCH_SIZE) {
    let pending = ids.slice(i, i + STAMP_BATCH_SIZE);
    let attempt = 0;

    while (pending.length > 0) {
      const { status, body } = await fetchStampBatch(auth, pending);
      const normalized = normalizeStampResponse(body, pending, status);

      console.log(
        `[STAMP] attempt ${attempt + 1} for [${pending.join(", ")}] -> HTTP ${status}`,
        JSON.stringify(body),
      );

      const stillPending: string[] = [];

      for (const result of normalized) {
        if (result.status !== "RETRY") {
          resultsById.set(result.id, result);
          continue;
        }

        if (attempt < STAMP_RETRY_DELAYS_MS.length) {
          stillPending.push(result.id);
        } else {
          // Retries exhausted — surface as a failure so it isn't silently lost.
          resultsById.set(result.id, {
            ...result,
            status: "FAILED",
            message: `${result.message} (retries exhausted)`,
          });
        }
      }

      pending = stillPending;

      if (pending.length > 0) {
        await delay(STAMP_RETRY_DELAYS_MS[attempt]);
        attempt += 1;
      }
    }
  }

  return resultsById;
}

export async function getInvoices(
  start: number = 0,
  limit: number = 30,
  startDate?: string,
  endDate?: string,
  query?: string,
) {
  const auth = await getAuthHeader();
  if (!auth) return { items: [], total: 0, hasMore: false };

  const safeLimit = Math.min(limit, 30);

  try {
    const q = query?.trim() || "";
    let url = `https://api.alegra.com/api/v1/invoices`;

    // 1. Handle ID Search
    // If input is strictly numbers (e.g. "123" or "12,13"), use the `id` parameter.
    // Note: Per docs, when `id` is present, other query params are ignored by Alegra.
    if (q && /^\d+(,\d+)*$/.test(q)) {
      url += `?id=${encodeURIComponent(q)}`;
    } else {
      // 2. Standard Search with Metadata & Filters
      url += `?metadata=true&start=${start}&limit=${safeLimit}`;

      if (q) {
        // If it has letters/dashes (e.g. "INV-101"), search full number; otherwise client name
        if (/\d/.test(q) && /[a-zA-Z\-]/.test(q)) {
          url += `&numberTemplate_fullNumber=${encodeURIComponent(q)}`;
        } else {
          url += `&client_name=${encodeURIComponent(q)}`;
        }
      }

      if (startDate && endDate) {
        url += `&date_afterOrNow=${startDate}&date_beforeOrNow=${endDate}`;
      }
    }

    const res = await fetch(url, {
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Alegra API Error:", res.status, await res.text());
      return { items: [], total: 0, hasMore: false };
    }

    const responseData = await res.json();

    // 3. Normalize Response (Handles both raw arrays and { metadata, data } objects)
    let items: any[] = [];
    let total = 0;

    if (Array.isArray(responseData)) {
      // Direct array response (triggered when `id` parameter is used)
      items = responseData;
      total = responseData.length;
    } else if (responseData && Array.isArray(responseData.data)) {
      // Standard response with metadata
      items = responseData.data;
      total = responseData.metadata?.total || items.length;
    }

    return {
      items,
      total,
      hasMore: start + items.length < total,
    };
  } catch (err) {
    console.error("Fetch Exception:", err);
    return { items: [], total: 0, hasMore: false };
  }
}

export async function getNumberTemplates(): Promise<NumberTemplate[]> {
  const auth = await getAuthHeader();
  if (!auth) return [];

  try {
    const res = await fetch("https://api.alegra.com/api/v1/number-templates", {
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getInvoicePdfUrl(id: string) {
  const auth = await getAuthHeader();
  if (!auth) return null;

  try {
    const res = await fetch(
      `https://api.alegra.com/api/v1/invoices/${id}?fields=pdf`,
      {
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store",
      },
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data.pdfUrl || data.pdf?.url || data.pdf || null;
  } catch {
    return null;
  }
}

export async function recreateAsTypeC(
  invoices: AlegraInvoice[],
  targetTemplateId?: string,
) {
  const auth = await getAuthHeader();

  if (!auth)
    return {
      success: false,
      error: "Not authenticated",
      manifest: [],
      createdInvoices: [],
    };

  try {
    let templateId = targetTemplateId;

    if (!templateId) {
      const templates = await getNumberTemplates();

      const typeCTemplate = templates.find(
        (t: NumberTemplate) =>
          t.subDocumentType === "INVOICE_C" ||
          t.prefix?.includes("C") ||
          t.name?.toLowerCase().includes("factura c"),
      );

      templateId = typeCTemplate?.id || templates[0]?.id;
    }

    if (!templateId) {
      return {
        success: false,
        error: "No valid Type C template found in Alegra.",
        manifest: [],
        createdInvoices: [],
      };
    }
    // const templateId = targetTemplateId || "3";

    const manifestMap = new Map<string, GenerationManifestRow>();

    // ==========================================
    // PHASE 1: CREATE ALL DRAFTS IN PARALLEL
    // ==========================================
    console.time("❌ [DEBUG LOG] PHASE 1: All Drafts Creation (Parallel) ❌");

    const draftPromises = invoices.map(async (inv) => {
      const timestamp = new Date().toISOString();
      const origNum =
        inv.numberTemplate?.fullNumber || inv.number || String(inv.id);

      const payload = {
        date: inv.date,
        dueDate: inv.dueDate || inv.date,
        client: { id: inv.client?.id },
        items: inv.items?.map((item: any) => ({
          id: item.id,
          price: item.price,
          quantity: item.quantity,
          discount: item.discount || 0,
          tax: item.tax ? item.tax.map((t: any) => ({ id: t.id })) : [],
        })),
        numberTemplate: { id: templateId },
        // numberTemplate: {
        //   id: "3",
        //   prefix: "00002",
        //   number: "4",
        //   text: null,
        //   documentType: "invoice",
        //   fullNumber: "00002-00000004",
        //   formattedNumber: "00000004",
        //   subDocumentType: "INVOICE_C",
        //   isElectronic: true,
        // },
        warehouse: inv.warehouse ? { id: inv.warehouse.id } : undefined,

        ...(inv.observations ? { observations: inv.observations } : {}),
        ...(inv.anotation ? { anotation: inv.anotation } : {}),
        ...(inv.term ? { term: inv.term } : {}),
        saleCondition: "CASH",
        // ...(inv.saleCondition ? { saleCondition: inv.saleCondition } : {}),
        ...(inv.saleConcept ? { saleConcept: inv.saleConcept } : {}),
        ...(inv.startDateService
          ? { startDateService: inv.startDateService }
          : {}),
        ...(inv.endDateService ? { endDateService: inv.endDateService } : {}),
      };

      console.log(payload);

      try {
        const res = await fetch("https://api.alegra.com/api/v1/invoices", {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseData = await res.json();

        console.log("responseData", responseData);

        if (!res.ok) {
          manifestMap.set(String(inv.id), {
            originalInvoiceId: String(inv.id),
            originalNumber: origNum,
            generatedInvoiceId: "",
            generatedNumber: "",
            clientId: String(inv.client?.id || ""),
            clientName: inv.client?.name || "",
            status: "Failed",
            error: `[STAGE 1: DRAFT CREATION FAILED] HTTP ${res.status}: ${responseData.message || "Failed to create draft invoice"}`,
            generatedAt: timestamp,
          });
          return null;
        }

        // Store pre-filled manifest entry
        manifestMap.set(String(inv.id), {
          originalInvoiceId: String(inv.id),
          originalNumber: origNum,
          generatedInvoiceId: String(responseData.id),
          generatedNumber:
            responseData.numberTemplate?.fullNumber ||
            responseData.number ||
            String(responseData.id),
          clientId: String(inv.client?.id || ""),
          clientName: inv.client?.name || "",
          status: "Failed",
          error:
            "[STAGE 2: STAMPING PENDING] Draft created successfully, awaiting AFIP stamping",
          generatedAt: timestamp,
        });

        return {
          originalId: String(inv.id),
          responseData,
        };
      } catch (err: any) {
        manifestMap.set(String(inv.id), {
          originalInvoiceId: String(inv.id),
          originalNumber: origNum,
          generatedInvoiceId: "",
          generatedNumber: "",
          clientId: String(inv.client?.id || ""),
          clientName: inv.client?.name || "",
          status: "Failed",
          error: `[STAGE 1: DRAFT CREATION NETWORK ERROR] ${err?.message || "Failed to connect to Alegra API"}`,
          generatedAt: timestamp,
        });
        return null;
      }
    });

    // Run all Phase 1 creations simultaneously
    const results = await Promise.all(draftPromises);
    console.timeEnd(
      "❌ [DEBUG LOG] PHASE 1: All Drafts Creation (Parallel) ❌",
    );

    // Filter out nulls (failed draft creations)
    const createdDrafts = results.filter(
      (item): item is { originalId: string; responseData: any } =>
        item !== null,
    );

    // ==========================================
    // PHASE 2: STAMP INVOICES (shared normalizer + retry helper)
    // ==========================================
    const createdInvoices: AlegraInvoice[] = [];

    if (createdDrafts.length > 0) {
      const draftIds = createdDrafts.map((item) =>
        String(item.responseData.id),
      );
      const stampResults = await stampInvoiceIds(auth, draftIds);

      for (const item of createdDrafts) {
        const id = String(item.responseData.id);
        const result = stampResults.get(id);
        const existingManifest = manifestMap.get(item.originalId);
        const isSuccess =
          result?.status === "ACCEPTED" || result?.status === "PROCESSING";

        if (isSuccess) {
          if (existingManifest) {
            existingManifest.status = "Success";
            existingManifest.error = "";
          }

          createdInvoices.push({
            ...item.responseData,
            emissionStatus: result?.emissionStatus || "STAMPED_AND_ACCEPTED",
          });
        } else if (existingManifest) {
          existingManifest.status = "Failed";
          existingManifest.error = `[STAGE 2: AFIP STAMPING FAILED] ${
            result?.message ||
            "Service unavailable / AFIP authorization refused"
          }`;
        }
      }
    }

    revalidatePath("/");

    return {
      success: true,
      manifest: Array.from(manifestMap.values()),
      createdInvoices,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "An unexpected error occurred",
      manifest: [],
      createdInvoices: [],
    };
  }
}

// Stamps already-existing invoices with AFIP without recreating them.
export async function stampInvoices(invoices: AlegraInvoice[]) {
  const auth = await getAuthHeader();

  if (!auth)
    return {
      success: false,
      error: "Not authenticated",
      manifest: [],
      stampedInvoices: [],
    };

  if (!invoices.length) {
    return {
      success: false,
      error: "No invoices provided",
      manifest: [],
      stampedInvoices: [],
    };
  }

  try {
    const ids = invoices.map((inv) => String(inv.id));
    const stampResults = await stampInvoiceIds(auth, ids);
    const timestamp = new Date().toISOString();

    const manifest: StampManifestRow[] = [];
    const stampedInvoices: AlegraInvoice[] = [];

    for (const inv of invoices) {
      const id = String(inv.id);
      const result = stampResults.get(id);
      const isSuccess =
        result?.status === "ACCEPTED" || result?.status === "PROCESSING";

      manifest.push({
        invoiceId: id,
        invoiceNumber: inv.numberTemplate?.fullNumber || inv.number || id,
        clientId: String(inv.client?.id || ""),
        clientName: inv.client?.name || "",
        status: isSuccess ? "Success" : "Failed",
        emissionStatus: result?.emissionStatus || "",
        error: isSuccess
          ? ""
          : `[STAMPING FAILED] ${result?.message || "Unknown stamping error"}`,
        stampedAt: timestamp,
      });

      if (isSuccess) {
        stampedInvoices.push({
          ...inv,
          emissionStatus:
            result?.emissionStatus ||
            (result?.status === "ACCEPTED"
              ? "STAMPED_AND_ACCEPTED"
              : "STAMPED_AND_WAITING_RESPONSE"),
        });
      }
    }

    revalidatePath("/");

    return {
      success: true,
      manifest,
      stampedInvoices,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "An unexpected error occurred",
      manifest: [],
      stampedInvoices: [],
    };
  }
}

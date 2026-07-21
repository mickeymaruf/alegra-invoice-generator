"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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

// --- Helper Functions ---
async function getAuthHeader() {
  const cookieStore = await cookies();
  const email = cookieStore.get("alegra_email")?.value;
  const token = cookieStore.get("alegra_token")?.value;

  if (!email || !token) return null;
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

export async function getInvoices(
  start: number = 0,
  limit: number = 30,
  startDate?: string,
  endDate?: string,
) {
  const auth = await getAuthHeader();
  if (!auth) return { items: [], total: 0, hasMore: false };

  const safeLimit = Math.min(limit, 30);

  try {
    let url = `https://api.alegra.com/api/v1/invoices?metadata=true&start=${start}&limit=${safeLimit}`;

    if (
      startDate &&
      endDate &&
      startDate.trim() !== "" &&
      endDate.trim() !== ""
    ) {
      url += `&date_start=${startDate}&date_end=${endDate}`;
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

    const items = Array.isArray(responseData.data) ? responseData.data : [];
    const total = responseData.metadata?.total || items.length;

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

    const manifestMap = new Map<string, GenerationManifestRow>();
    const createdDrafts: { originalId: string; responseData: any }[] = [];

    // ==========================================
    // PHASE 1: CREATE ALL INVOICES AS DRAFTS
    // ==========================================
    for (const inv of invoices) {
      const timestamp = new Date().toISOString();
      const origNum =
        inv.numberTemplate?.fullNumber || inv.number || String(inv.id);

      // Clean payload (exclude read-only metadata)
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
        warehouse: inv.warehouse ? { id: inv.warehouse.id } : undefined,

        observations: inv.observations || undefined,
        anotation: inv.anotation || undefined,

        term: inv.term,
        saleCondition: inv.saleCondition,
        saleConcept: inv.saleConcept,
        startDateService: inv.startDateService,
        endDateService: inv.endDateService,
      };

      // ❌ [DEBUG LOG] Start timer before POST /invoices ❌
      console.time(
        `❌ [DEBUG LOG] STAGE 1: POST /invoices (Original ID: ${inv.id}) ❌`,
      );

      let res;
      let responseData;

      try {
        res = await fetch("https://api.alegra.com/api/v1/invoices", {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        responseData = await res.json();
      } catch (networkErr: any) {
        // Handle fetch level/network timeout during draft creation
        manifestMap.set(String(inv.id), {
          originalInvoiceId: String(inv.id),
          originalNumber: origNum,
          generatedInvoiceId: "",
          generatedNumber: "",
          clientId: String(inv.client?.id || ""),
          clientName: inv.client?.name || "",
          status: "Failed",
          error: `[STAGE 1: DRAFT CREATION NETWORK ERROR] ${networkErr?.message || "Failed to connect to Alegra API"}`,
          generatedAt: timestamp,
        });
        continue;
      } finally {
        // ❌ [DEBUG LOG] End timer after POST /invoices ❌
        console.timeEnd(
          `❌ [DEBUG LOG] STAGE 1: POST /invoices (Original ID: ${inv.id}) ❌`,
        );
      }

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
        continue;
      }

      // Store successfully created draft info
      createdDrafts.push({
        originalId: String(inv.id),
        responseData,
      });

      // Pre-fill manifest as Failed (pending Stage 2)
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
    }

    // ==========================================
    // PHASE 2: BATCH STAMP INVOICES (CHUNKS OF 10)
    // ==========================================
    const BATCH_SIZE = 10;
    const createdInvoices: AlegraInvoice[] = [];

    for (let i = 0; i < createdDrafts.length; i += BATCH_SIZE) {
      const chunk = createdDrafts.slice(i, i + BATCH_SIZE);
      const chunkIds = chunk.map((item) => String(item.responseData.id));

      // ❌ [DEBUG LOG] Start timer before POST /invoices/stamp ❌
      console.time(
        `❌ [DEBUG LOG] STAGE 2: POST /invoices/stamp (Chunk ${i / BATCH_SIZE + 1}, IDs: [${chunkIds.join(", ")}]) ❌`,
      );

      try {
        const stampRes = await fetch(
          "https://api.alegra.com/api/v1/invoices/stamp",
          {
            method: "POST",
            headers: {
              Authorization: auth,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: chunkIds }),
          },
        );

        const stampData = await stampRes.json();
        const stampResultsArray: any[] = stampData?.data || [];

        // Map results back to manifest and createdInvoices
        for (const item of chunk) {
          const genId = String(item.responseData.id);
          const itemStampResult = stampResultsArray.find(
            (r: any) => String(r.id) === genId,
          );

          const existingManifest = manifestMap.get(item.originalId);

          if (stampRes.ok && itemStampResult?.success === true) {
            if (existingManifest) {
              existingManifest.status = "Success";
              existingManifest.error = "";
            }

            createdInvoices.push({
              ...item.responseData,
              emissionStatus:
                itemStampResult.emissionStatus || "STAMPED_AND_ACCEPTED",
            });
          } else {
            if (existingManifest) {
              existingManifest.status = "Failed";
              existingManifest.error = `[STAGE 2: AFIP STAMPING FAILED] HTTP ${stampRes.status}: ${
                itemStampResult?.message ||
                stampData?.message ||
                "Service unavailable / AFIP authorization refused"
              }`;
            }
          }
        }
      } catch (err: any) {
        // Handle network/timeout error during stamping
        for (const item of chunk) {
          const existingManifest = manifestMap.get(item.originalId);
          if (existingManifest) {
            existingManifest.status = "Failed";
            existingManifest.error = `[STAGE 2: STAMPING NETWORK ERROR] ${err?.message || "Service unavailable during AFIP stamping"}`;
          }
        }
      } finally {
        // ❌ [DEBUG LOG] End timer after POST /invoices/stamp ❌
        console.timeEnd(
          `❌ [DEBUG LOG] STAGE 2: POST /invoices/stamp (Chunk ${i / BATCH_SIZE + 1}, IDs: [${chunkIds.join(", ")}]) ❌`,
        );
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

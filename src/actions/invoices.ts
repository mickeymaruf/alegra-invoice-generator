"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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

  // Alegra API strictly caps limit at 30
  const safeLimit = Math.min(limit, 30);

  try {
    let url = `https://api.alegra.com/api/v1/invoices?start=${start}&limit=${safeLimit}`;

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
      return { items: [], hasMore: false };
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];

    return {
      items,
      hasMore: items.length === safeLimit,
    };
  } catch (err) {
    console.error("Fetch Exception:", err);
    return { items: [], hasMore: false };
  }
}

export async function getNumberTemplates() {
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

export async function recreateAsTypeC(
  invoices: any[],
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
        (t: any) =>
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

    const manifest: GenerationManifestRow[] = [];
    const createdInvoices: any[] = [];

    for (const inv of invoices) {
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
        warehouse: inv.warehouse ? { id: inv.warehouse.id } : undefined,
        observations: inv.observations || undefined,
        anotation: inv.anotation || undefined,
      };

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

      if (res.ok) {
        createdInvoices.push(responseData);

        manifest.push({
          originalInvoiceId: String(inv.id),
          originalNumber: origNum,
          generatedInvoiceId: String(responseData.id || ""),
          generatedNumber:
            responseData.numberTemplate?.fullNumber ||
            responseData.number ||
            String(responseData.id || ""),
          clientId: String(inv.client?.id || ""),
          clientName: inv.client?.name || "",
          status: "Success",
          error: "",
          generatedAt: timestamp,
        });
      } else {
        manifest.push({
          originalInvoiceId: String(inv.id),
          originalNumber: origNum,
          generatedInvoiceId: "",
          generatedNumber: "",
          clientId: String(inv.client?.id || ""),
          clientName: inv.client?.name || "",
          status: "Failed",
          error: responseData.message || "Failed to create invoice",
          generatedAt: timestamp,
        });
      }
    }

    revalidatePath("/");
    return { success: true, manifest, createdInvoices };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "An unexpected error occurred",
      manifest: [],
      createdInvoices: [],
    };
  }
}

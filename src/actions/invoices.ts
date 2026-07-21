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

export async function getInvoices() {
  const auth = await getAuthHeader();
  if (!auth) return [];

  try {
    const res = await fetch("https://api.alegra.com/api/v1/invoices?limit=30", {
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Fetch available Number Templates from Alegra
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

// Batch Recreate Selected Invoices as Type C
export async function recreateAsTypeC(
  invoices: any[],
  targetTemplateId?: string,
) {
  const auth = await getAuthHeader();
  if (!auth) return { success: false, error: "Not authenticated" };

  try {
    // 1. Fetch available templates if targetTemplateId is not explicitly provided
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
      };
    }

    const results = [];

    // 2. Loop through selected invoices and create new Type C invoices
    for (const inv of invoices) {
      // Direct reuse of existing client and line item attributes
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
        results.push({
          originalId: inv.id,
          newInvoice: responseData,
          success: true,
        });
      } else {
        results.push({
          originalId: inv.id,
          success: false,
          error: responseData.message || "Failed to create invoice",
        });
      }
    }

    revalidatePath("/");
    return { success: true, results };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "An unexpected error occurred",
    };
  }
}

// Fetch PDF download URL for a specific invoice
export async function getInvoicePdfUrl(id: string) {
  const auth = await getAuthHeader();
  if (!auth) return null;

  try {
    const res = await fetch(
      `https://api.alegra.com/api/v1/invoices/${id}?fields=pdf`,
      {
        headers: {
          Authorization: auth,
          Accept: "application/json",
        },
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

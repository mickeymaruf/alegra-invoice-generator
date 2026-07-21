"use server";

import { cookies } from "next/headers";

export async function getInvoices() {
  const cookieStore = await cookies();

  const email = cookieStore.get("alegra_email")?.value;
  const token = cookieStore.get("alegra_token")?.value;

  if (!email || !token) {
    return [];
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  try {
    const res = await fetch("https://api.alegra.com/api/v1/invoices?limit=30", {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    return await res.json();
  } catch {
    return [];
  }
}

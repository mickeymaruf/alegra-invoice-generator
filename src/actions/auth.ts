"use server";

import { cookies } from "next/headers";

const ALEGRA_URL = "https://api.alegra.com/api/v1/invoices?limit=1";

export async function login(_: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const token = formData.get("token") as string;

  if (!email || !token) {
    return {
      success: false,
      message: "Email and API Token are required.",
    };
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  try {
    const res = await fetch(ALEGRA_URL, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        message: "Invalid credentials.",
      };
    }

    const cookieStore = await cookies();

    cookieStore.set("alegra_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    cookieStore.set("alegra_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return {
      success: true,
      message: "Successfully authenticated with Alegra.",
    };
  } catch {
    return {
      success: false,
      message: "Unable to connect to Alegra.",
    };
  }
}

export async function getSavedCredentials() {
  const cookieStore = await cookies();

  const email = cookieStore.get("alegra_email")?.value;
  const token = cookieStore.get("alegra_token")?.value;

  if (!email || !token) {
    return null;
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  try {
    const res = await fetch(ALEGRA_URL, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      cookieStore.delete("alegra_email");
      cookieStore.delete("alegra_token");
      return null;
    }

    return {
      email,
      token,
      authenticated: true,
    };
  } catch {
    return null;
  }
}

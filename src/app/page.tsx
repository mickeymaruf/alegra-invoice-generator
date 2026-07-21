import LoginForm from "@/components/LoginForm";
import { getSavedCredentials } from "@/actions/auth";
import { getInvoices } from "@/actions/invoices";
import { InvoiceDataTable } from "@/components/invoices/data-table";
import { columns } from "@/components/invoices/columns";
import Image from "next/image";

export default async function Home() {
  const credentials = await getSavedCredentials();

  // 1. Fetch initial invoices object
  const invoicesRes = credentials?.authenticated
    ? await getInvoices(0, 10)
    : null;

  // 2. Safely fallback to an empty array
  const initialInvoices = invoicesRes?.items || [];

  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="border-b bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-1">
            <Image
              src="/alegra-logo.svg"
              alt="Alegra Logo"
              width={110}
              height={32}
              priority
              className="h-8 w-auto object-contain"
            />

            <h1 className="text-lg font-semibold tracking-wide text-[#2bbab4]">
              Invoice Generator
            </h1>
          </div>

          <div className="flex max-w-xl w-full justify-end">
            <LoginForm
              email={credentials?.email}
              token={credentials?.token}
              authenticated={credentials?.authenticated}
            />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl p-6">
        {credentials?.authenticated ? (
          /* 3. Pass initialInvoices to initialData */
          <InvoiceDataTable columns={columns} initialData={initialInvoices} />
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
            Please authenticate with your Alegra account.
          </div>
        )}
      </div>
    </main>
  );
}

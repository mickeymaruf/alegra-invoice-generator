import LoginForm from "@/components/LoginForm";
import { getSavedCredentials } from "@/actions/auth";
import { getInvoices } from "@/actions/invoices";
import { InvoiceDataTable } from "@/components/invoices/data-table";
import { columns } from "@/components/invoices/columns";

export default async function Home() {
  const credentials = await getSavedCredentials();
  const invoices = credentials?.authenticated ? await getInvoices() : [];

  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="border-b bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">
            Alegra <span className="text-blue-600">Invoice Generator</span>
          </h1>

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
          <InvoiceDataTable columns={columns} data={invoices} />
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
            Please authenticate with your Alegra account.
          </div>
        )}
      </div>
    </main>
  );
}

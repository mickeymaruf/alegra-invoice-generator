import LoginForm from "@/components/LoginForm";
import { getSavedCredentials } from "@/actions/auth";
import { getInvoices } from "@/actions/invoices";

export default async function Home() {
  const credentials = await getSavedCredentials();

  const invoices = credentials?.authenticated ? await getInvoices() : [];

  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="px-6 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-bold">
            Alegra <span className="text-blue-600">Invoice Generator</span>
          </h1>

          <div className="max-w-xl w-full flex justify-end">
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
          <>
            <div className="rounded-lg bg-white shadow border">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Number</th>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b">
                      <td className="p-3">{invoice.number}</td>

                      <td className="p-3">{invoice.client?.name}</td>

                      <td className="p-3">{invoice.date}</td>

                      <td className="p-3 text-right">{invoice.total}</td>

                      <td className="p-3 text-center">{invoice.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {invoices.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No invoices found.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
            Please authenticate with your Alegra account.
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { GenerationManifestRow } from "@/actions/invoices";
import { mapInvoiceToAlegraExportRow } from "@/lib/export-utils";

interface GenerationSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  manifest: GenerationManifestRow[];
  generatedInvoices?: any[]; // Full invoice objects returned from generation
}

export function GenerationSummaryDialog({
  open,
  onClose,
  manifest,
  generatedInvoices = [],
}: GenerationSummaryDialogProps) {
  const successCount = manifest.filter((m) => m.status === "Success").length;
  const failedCount = manifest.filter((m) => m.status === "Failed").length;

  // 1. Primary Action: Export Generated Invoices in Native 32-Column Alegra CSV
  const downloadGeneratedAlegraExport = () => {
    if (!generatedInvoices || generatedInvoices.length === 0) {
      alert("No generated invoices available for export.");
      return;
    }

    const rows: any[] = [];
    generatedInvoices.forEach((inv) => {
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach((item: any) => {
          rows.push(mapInvoiceToAlegraExportRow(inv, item));
        });
      } else {
        rows.push(mapInvoiceToAlegraExportRow(inv, {}));
      }
    });

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);

    // Native Alegra CSV formatting with 'sep=;' header
    const csvLines = [
      "sep=;",
      headers.map((h) => `"${h}"`).join(";"),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val =
              row[h] !== undefined && row[h] !== null ? String(row[h]) : "";
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(";"),
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Alegra_Generated_TypeC_Invoices_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Secondary Action: Optional Manifest Download
  const downloadManifestCsv = () => {
    if (manifest.length === 0) return;

    const headers = [
      "originalInvoiceId",
      "originalNumber",
      "generatedInvoiceId",
      "generatedNumber",
      "clientId",
      "clientName",
      "status",
      "error",
      "generatedAt",
    ];

    const rows = manifest.map((row) => [
      `"${row.originalInvoiceId}"`,
      `"${row.originalNumber}"`,
      `"${row.generatedInvoiceId}"`,
      `"${row.generatedNumber}"`,
      `"${row.clientId}"`,
      `"${row.clientName.replace(/"/g, '""')}"`,
      `"${row.status}"`,
      `"${row.error.replace(/"/g, '""')}"`,
      `"${row.generatedAt}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `generation_manifest_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md p-6 bg-white rounded-xl border border-gray-200 shadow-xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Generation Complete
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Successfully created{" "}
            <span className="font-semibold text-emerald-600">
              {successCount}
            </span>{" "}
            Type C {successCount === 1 ? "invoice" : "invoices"}.
          </p>

          {failedCount > 0 && (
            <p className="text-sm text-red-600 font-medium">
              Failed: {failedCount}
            </p>
          )}

          {failedCount === 0 && (
            <p className="text-xs text-gray-500">Failed: 0</p>
          )}
        </div>

        <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-100">
          {/* MAIN PRIMARY ACTION: Native Alegra CSV Export */}
          <Button
            onClick={downloadGeneratedAlegraExport}
            className="w-full bg-[#2bbab4] hover:bg-[#24a39e] text-white font-medium gap-2 h-10 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export Generated Invoices (.CSV)
          </Button>

          {/* SECONDARY ACTION: Optional Manifest CSV */}
          <Button
            variant="outline"
            onClick={downloadManifestCsv}
            className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 h-9 text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500" />
            Download Generation Manifest (Optional)
          </Button>

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-500 hover:text-gray-800 text-xs h-8"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

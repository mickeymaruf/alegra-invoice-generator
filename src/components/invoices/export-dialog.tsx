"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Calendar, FileText, Loader2 } from "lucide-react";
import { getInvoices } from "@/actions/invoices";
import { mapInvoiceToAlegraExportRow } from "@/lib/export-utils";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  selectedInvoices: any[];
}

export function ExportDialog({
  open,
  onClose,
  selectedInvoices,
}: ExportDialogProps) {
  const [exportScope, setExportScope] = React.useState<
    "selected" | "date_range"
  >(selectedInvoices.length > 0 ? "selected" : "date_range");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [format, setFormat] = React.useState<"csv" | "xlsx">("csv");
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (selectedInvoices.length > 0) {
      setExportScope("selected");
    } else {
      setExportScope("date_range");
    }
  }, [selectedInvoices]);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let invoicesToExport = selectedInvoices;

      if (exportScope === "date_range") {
        invoicesToExport = await getInvoices(startDate, endDate);
      }

      if (invoicesToExport.length === 0) {
        alert("No invoices found to export.");
        setIsExporting(false);
        return;
      }

      // Map invoices to flat rows matching native export
      const rows: any[] = [];

      invoicesToExport.forEach((inv) => {
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach((item: any) => {
            rows.push(mapInvoiceToAlegraExportRow(inv, item));
          });
        } else {
          rows.push(mapInvoiceToAlegraExportRow(inv, {}));
        }
      });

      if (rows.length === 0) {
        alert("No row data generated.");
        setIsExporting(false);
        return;
      }

      const headers = Object.keys(rows[0]);

      if (format === "csv") {
        // Native Alegra CSV formatting with 'sep=;' prefix
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
          `Alegra_Invoices_Export_${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Simple fallback CSV/TSV download for Excel (.xlsx compatible)
        const tsvLines = [
          headers.join("\t"),
          ...rows.map((row) =>
            headers.map((h) => String(row[h] || "")).join("\t"),
          ),
        ];
        const blob = new Blob([tsvLines.join("\n")], {
          type: "application/vnd.ms-excel;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `Alegra_Invoices_Export_${new Date().toISOString().slice(0, 10)}.xls`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      onClose();
    } catch (err: any) {
      alert("Error exporting invoices: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md p-6 bg-white rounded-xl border border-gray-200 shadow-xl">
        <DialogHeader className="pb-2 border-b border-gray-100">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Download className="h-5 w-5 text-[#2bbab4]" />
            Export Invoices
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Export Scope Option */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">
              Export Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope("selected")}
                disabled={selectedInvoices.length === 0}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                  exportScope === "selected"
                    ? "border-[#2bbab4] bg-[#2bbab4]/10 text-[#2bbab4]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                } ${selectedInvoices.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Selected ({selectedInvoices.length})
              </button>

              <button
                type="button"
                onClick={() => setExportScope("date_range")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                  exportScope === "date_range"
                    ? "border-[#2bbab4] bg-[#2bbab4]/10 text-[#2bbab4]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Date Range Filter
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          {exportScope === "date_range" && (
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                <Calendar className="h-3.5 w-3.5 text-[#2bbab4]" /> Date Range
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-gray-500">From</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs border-gray-300"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-gray-500">To</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs border-gray-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Export Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-2 ${
                  format === "csv"
                    ? "border-[#2bbab4] bg-[#2bbab4]/10 text-[#2bbab4]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FileText className="h-4 w-4" /> Native Alegra CSV (.csv)
              </button>

              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-2 ${
                  format === "xlsx"
                    ? "border-[#2bbab4] bg-[#2bbab4]/10 text-[#2bbab4]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FileText className="h-4 w-4" /> Excel (.xls)
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full bg-[#2bbab4] hover:bg-[#24a39e] text-white font-medium gap-2 h-10"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Export
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 h-10"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

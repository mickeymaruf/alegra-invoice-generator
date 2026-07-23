"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileSpreadsheet } from "lucide-react";
import { StampManifestRow } from "@/actions/invoices";

interface StampSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  manifest: StampManifestRow[];
}

export function StampSummaryDialog({
  open,
  onClose,
  manifest,
}: StampSummaryDialogProps) {
  const successCount = manifest.filter((m) => m.status === "Success").length;
  const failedCount = manifest.filter((m) => m.status === "Failed").length;

  const downloadManifestCsv = () => {
    if (manifest.length === 0) return;

    const headers = [
      "invoiceId",
      "invoiceNumber",
      "clientId",
      "clientName",
      "status",
      "emissionStatus",
      "error",
      "stampedAt",
    ];

    const rows = manifest.map((row) => [
      `"${row.invoiceId}"`,
      `"${row.invoiceNumber}"`,
      `"${row.clientId}"`,
      `"${row.clientName.replace(/"/g, '""')}"`,
      `"${row.status}"`,
      `"${row.emissionStatus}"`,
      `"${row.error.replace(/"/g, '""')}"`,
      `"${row.stampedAt}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `stamp_manifest_${new Date().toISOString().slice(0, 10)}.csv`,
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
            Stamping Complete
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Successfully stamped{" "}
            <span className="font-semibold text-emerald-600">
              {successCount}
            </span>{" "}
            {successCount === 1 ? "invoice" : "invoices"}.
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
          <Button
            onClick={downloadManifestCsv}
            className="w-full bg-[#2bbab4] hover:bg-[#24a39e] text-white font-medium gap-2 h-10 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Stamp Manifest (.CSV)
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

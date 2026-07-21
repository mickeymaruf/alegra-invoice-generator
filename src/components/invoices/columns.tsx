"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Invoice } from "@/app/types/invoice";
import {
  MoreVertical,
  Coins,
  FileDown,
  Loader2,
  CheckCircle2,
  CircleEllipsis,
  XCircle,
  Clock,
  CircleOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInvoicePdfUrl } from "@/actions/invoices";

function ActionMenuCell({ invoice }: { invoice: Invoice }) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const isPending = invoice.status?.toLowerCase() === "open";

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const pdfUrl = await getInvoicePdfUrl(String(invoice.id));
      if (pdfUrl) {
        window.open(pdfUrl, "_blank");
      } else {
        alert("Could not retrieve the PDF for this invoice.");
      }
    } catch {
      alert("An error occurred while fetching the PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {isPending && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
        >
          <Coins className="h-4 w-4" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none">
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="cursor-pointer gap-2 text-sm text-gray-700"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#2bbab4]" />
            ) : (
              <FileDown className="h-4 w-4 text-gray-500" />
            )}
            Download PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const columns: ColumnDef<Invoice>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="border-gray-300 data-[state=checked]:bg-[#2bbab4] data-[state=checked]:border-[#2bbab4]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="border-gray-300 data-[state=checked]:bg-[#2bbab4] data-[state=checked]:border-[#2bbab4]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "type",
    header: () => (
      <span className="text-xs font-semibold text-gray-600">Type</span>
    ),
    cell: ({ row }) => {
      const subType = row.original.numberTemplate?.subDocumentType;
      const typeDisplay = subType ? subType.replace("INVOICE_", "") : "C";

      return (
        <span className="text-sm font-normal text-gray-800">{typeDisplay}</span>
      );
    },
  },
  {
    accessorKey: "number",
    header: () => (
      <span className="text-xs font-semibold text-gray-600">Number</span>
    ),
    cell: ({ row }) => {
      const fullNumber =
        row.original.numberTemplate?.fullNumber || row.original.number || "";
      return (
        <span className="text-sm font-normal text-gray-600">{fullNumber}</span>
      );
    },
  },
  {
    accessorKey: "client",
    header: () => (
      <span className="text-xs font-semibold text-gray-600">Client</span>
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium text-gray-800 uppercase">
        {row.original.client?.name || "—"}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: () => (
      <span className="text-xs font-semibold text-gray-600">Creation</span>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-gray-600">
        {row.getValue("date") || "—"}
      </span>
    ),
  },
  {
    accessorKey: "dueDate",
    header: () => (
      <span className="text-xs font-semibold text-gray-600">Expiration</span>
    ),
    cell: ({ row }) => {
      const dueDateStr = row.original.dueDate || row.original.date;
      const status = row.original.status?.toLowerCase();

      const isPastDue =
        dueDateStr && new Date(dueDateStr) < new Date() && status === "open";

      return (
        <span
          className={`text-sm ${
            isPastDue ? "text-red-500 font-medium" : "text-gray-600"
          }`}
        >
          {dueDateStr || "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "total",
    header: () => (
      <div className="text-right text-xs font-semibold text-gray-600">
        Total
      </div>
    ),
    cell: ({ row }) => {
      const total = Number(row.getValue("total")) || 0;
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(total);

      return (
        <div className="text-right text-sm text-gray-800 font-medium">
          {formatted}
        </div>
      );
    },
  },
  {
    accessorKey: "balance",
    header: () => (
      <div className="text-right text-xs font-semibold text-gray-600">
        To be charged
      </div>
    ),
    cell: ({ row }) => {
      const balance = row.original.balance;
      if (
        balance === undefined ||
        balance === null ||
        row.original.status === "draft"
      ) {
        return <div className="text-right text-sm text-gray-500">-</div>;
      }
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(Number(balance));

      return (
        <div className="text-right text-sm text-gray-800 font-medium">
          {formatted}
        </div>
      );
    },
  },
  {
    id: "emissionStatus",
    header: () => (
      <span className="text-xs font-semibold text-slate-700">
        Emission status
      </span>
    ),
    cell: ({ row }) => {
      const isElectronic = row.original.numberTemplate?.isElectronic;
      const legalStatus = row.original.stamp?.legalStatus;

      let label = "To be issued";
      let textColor = "text-slate-600";
      let Icon = CircleEllipsis;

      if (!isElectronic) {
        label = "Not electronic";
        textColor = "text-slate-400";
        Icon = CircleOff;
      } else if (legalStatus === "STAMPED_AND_ACCEPTED") {
        label = "Approved";
        textColor = "text-emerald-600";
        Icon = CheckCircle2;
      } else if (legalStatus === "STAMPED_AND_WAITING_RESPONSE") {
        label = "In process";
        textColor = "text-amber-600";
        Icon = Clock;
      } else if (legalStatus === "STAMPED_AND_REJECTED") {
        label = "Rejected";
        textColor = "text-red-600";
        Icon = XCircle;
      } else if (legalStatus === "PENDING") {
        label = "To be issued";
        textColor = "text-slate-600";
        Icon = CircleEllipsis;
      }

      return (
        <div
          className={`flex items-center gap-2 text-sm font-normal ${textColor}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="text-center text-xs font-semibold text-gray-600">
        Status
      </div>
    ),
    cell: ({ row }) => {
      const statusRaw =
        (row.getValue("status") as string)?.toLowerCase() || "draft";

      let label = "Draft";
      let badgeStyle = "bg-[#EEF2FF] text-[#4F46E5]";

      if (statusRaw === "open") {
        label = "Pending";
        badgeStyle = "bg-[#FEF3C7] text-[#B45309]";
      } else if (statusRaw === "closed") {
        label = "Paid";
        badgeStyle = "bg-emerald-50 text-emerald-700";
      } else if (statusRaw === "void") {
        label = "Void";
        badgeStyle = "bg-gray-100 text-gray-600";
      }

      return (
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs ${badgeStyle}`}
          >
            {label}
          </span>
        </div>
      );
    },
  },
  // {
  //   id: "actions",
  //   header: () => null,
  //   cell: ({ row }) => <ActionMenuCell invoice={row.original} />,
  // },
];

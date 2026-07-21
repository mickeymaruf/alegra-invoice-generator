"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  Download,
  Plus,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { recreateAsTypeC, GenerationManifestRow } from "@/actions/invoices";
import { ExportDialog } from "@/components/invoices/export-dialog";
import { GenerationSummaryDialog } from "./generation-summary-dialog";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function InvoiceDataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [selectedType, setSelectedType] = React.useState<string>("INVOICE_C");
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);

  // Summary Dialog State
  const [summaryOpen, setSummaryOpen] = React.useState<boolean>(false);
  const [manifestData, setManifestData] = React.useState<
    GenerationManifestRow[]
  >([]);
  const [generatedInvoices, setGeneratedInvoices] = React.useState<any[]>([]);

  // Export Dialog State
  const [exportOpen, setExportOpen] = React.useState<boolean>(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    state: {
      rowSelection,
      columnFilters,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  const handleRecreate = async () => {
    if (selectedRows.length === 0) return;

    setIsGenerating(true);
    const selectedInvoices = selectedRows.map((r) => r.original);

    const res = await recreateAsTypeC(selectedInvoices);
    setIsGenerating(false);

    if (res.success && res.manifest) {
      setManifestData(res.manifest);
      setGeneratedInvoices(res.createdInvoices || []);
      setSummaryOpen(true);
      setRowSelection({});
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales invoices</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, edit, and manage detailed invoices for your business
            transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setExportOpen(true)}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-4 h-10 gap-2"
          >
            <Download className="h-4 w-4 text-gray-600" />
            Export
          </Button>

          <Button className="bg-[#2bbab4] hover:bg-[#24a39e] text-white font-medium px-4 h-10 gap-1">
            <Plus className="h-4 w-4" />
            New sales invoice
            <ChevronDown className="h-4 w-4 ml-1 opacity-80" />
          </Button>
        </div>
      </div>

      {/* Main Table Card Wrapper */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="flex items-center gap-4 p-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar client"
              value={
                (table.getColumn("client")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("client")?.setFilterValue(event.target.value)
              }
              className="pl-9 border-gray-300 rounded-full text-sm h-9 focus-visible:ring-[#2bbab4]"
            />
          </div>

          <Button
            variant="ghost"
            className="text-gray-600 hover:text-gray-900 gap-2 text-sm font-medium h-9"
          >
            <Filter className="h-4 w-4 text-gray-500" />
            Filter
          </Button>

          {/* Type Selector & Action Button Trigger */}
          {selectedRows.length > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">
                  Target Type:
                </span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md p-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2bbab4]"
                >
                  <option value="INVOICE_C">Type C Invoice</option>
                </select>
              </div>

              <span className="text-xs text-gray-400">|</span>

              <span className="text-xs text-gray-500">
                {selectedRows.length} selected
              </span>

              <Button
                size="sm"
                disabled={isGenerating}
                className="bg-[#2bbab4] hover:bg-[#24a39e] text-white gap-2"
                onClick={handleRecreate}
              >
                {isGenerating && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Recreate as Type C
              </Button>
            </div>
          )}
        </div>

        {/* Data Table */}
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-gray-200"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="py-3 px-4 first:border-r-0 border-r border-gray-100 last:border-r-0"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b border-gray-100 hover:bg-slate-50/60 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 px-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-gray-400"
                >
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Generation Summary Dialog */}
      <GenerationSummaryDialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        manifest={manifestData}
        generatedInvoices={generatedInvoices}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        selectedInvoices={selectedRows.map((r) => r.original)}
      />
    </div>
  );
}

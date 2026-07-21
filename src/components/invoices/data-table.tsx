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
  PaginationState,
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
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  getInvoices,
  recreateAsTypeC,
  GenerationManifestRow,
} from "@/actions/invoices";
import { ExportDialog } from "@/components/invoices/export-dialog";
import { GenerationSummaryDialog } from "./generation-summary-dialog";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  initialData: TData[];
}

export function InvoiceDataTable<TData, TValue>({
  columns,
  initialData,
}: DataTableProps<TData, TValue>) {
  // ----------------------------------------------------
  // Cache Store: Maps "pageIndex_pageSize" -> { items, total, hasMore }
  // ----------------------------------------------------
  const [cache, setCache] = React.useState<
    Record<string, { items: TData[]; total: number; hasMore: boolean }>
  >({});

  const [data, setData] = React.useState<TData[]>(initialData);
  const [totalItems, setTotalItems] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [hasMore, setHasMore] = React.useState<boolean>(true);

  // Pagination State
  const [{ pageIndex, pageSize }, setPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    });

  // Direct Page Jump Input State
  const [pageInput, setPageInput] = React.useState<string>("1");

  // ----------------------------------------------------
  // Global Selected Objects Registry (Preserves across pages)
  // ----------------------------------------------------
  const [selectedObjects, setSelectedObjects] = React.useState<
    Record<string, any>
  >({});

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [selectedType, setSelectedType] = React.useState<string>("INVOICE_C");
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);

  // Dialog States
  const [summaryOpen, setSummaryOpen] = React.useState<boolean>(false);
  const [manifestData, setManifestData] = React.useState<
    GenerationManifestRow[]
  >([]);
  const [generatedInvoices, setGeneratedInvoices] = React.useState<any[]>([]);
  const [exportOpen, setExportOpen] = React.useState<boolean>(false);

  // ----------------------------------------------------
  // Fetch Engine with Client Cache
  // ----------------------------------------------------
  const fetchPage = React.useCallback(
    async (page: number, size: number, forceRefresh = false) => {
      const cacheKey = `${page}_${size}`;

      // ⚡ CACHE HIT: Load instantly from React memory
      if (!forceRefresh && cache[cacheKey]) {
        setData(cache[cacheKey].items);
        setTotalItems(cache[cacheKey].total);
        setHasMore(cache[cacheKey].hasMore);
        setPageInput(String(page + 1));
        return;
      }

      // 🌐 CACHE MISS / REFRESH: Network Request
      setIsLoading(true);
      const startOffset = page * size;
      const res = await getInvoices(startOffset, size);

      const items = (res.items as TData[]) || [];
      const total = res.total || 0;
      const fetchHasMore = res.hasMore;

      setData(items);
      setTotalItems(total);
      setHasMore(fetchHasMore);
      setPageInput(String(page + 1));

      // Store in memory
      setCache((prev) => ({
        ...prev,
        [cacheKey]: { items, total, hasMore: fetchHasMore },
      }));

      setIsLoading(false);
    },
    [cache],
  );

  // Fetch initial page data metadata on mount if needed
  React.useEffect(() => {
    fetchPage(0, 10);
  }, []);

  // Navigation handlers
  const handlePageChange = (newPageIndex: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPageIndex }));
    fetchPage(newPageIndex, pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newPageSize });
    fetchPage(0, newPageSize);
  };

  // Hard Refresh (used after batch creations)
  const handleFreshReload = () => {
    setCache({});
    fetchPage(pageIndex, pageSize, true);
  };

  // Synchronize multi-page selection state
  const handleRowSelectionChange = (
    updaterOrValue:
      | RowSelectionState
      | ((old: RowSelectionState) => RowSelectionState),
  ) => {
    const nextSelection =
      typeof updaterOrValue === "function"
        ? updaterOrValue(rowSelection)
        : updaterOrValue;

    setRowSelection(nextSelection);

    setSelectedObjects((prev) => {
      const updated = { ...prev };
      data.forEach((item: any) => {
        const id = String(item.id);
        if (nextSelection[id]) {
          updated[id] = item;
        } else {
          delete updated[id];
        }
      });
      return updated;
    });
  };

  // Page input keyboard submission
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      let targetPage = parseInt(pageInput, 10);
      if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
      if (targetPage > totalPages) targetPage = totalPages;

      const newIndex = targetPage - 1;
      setPagination((prev) => ({ ...prev, pageIndex: newIndex }));
      fetchPage(newIndex, pageSize);
    }
  };

  const table = useReactTable({
    data,
    columns,
    pageCount: -1,
    manualPagination: true,
    getRowId: (row: any) => String(row.id), // ID-based selection key across pages
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: handleRowSelectionChange,
    onColumnFiltersChange: setColumnFilters,
    state: {
      rowSelection,
      columnFilters,
      pagination: { pageIndex, pageSize },
    },
  });

  const batchSelectedInvoices = Object.values(selectedObjects);
  const totalSelectedCount = Object.keys(rowSelection).length;

  const handleRecreate = async () => {
    if (batchSelectedInvoices.length === 0) return;

    setIsGenerating(true);
    const res = await recreateAsTypeC(batchSelectedInvoices);
    setIsGenerating(false);

    if (res.success && res.manifest) {
      setManifestData(res.manifest);
      setGeneratedInvoices(res.createdInvoices || []);
      setSummaryOpen(true);
      setRowSelection({});
      setSelectedObjects({});
      handleFreshReload();
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
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
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

          {/* Batch Action Bar */}
          {totalSelectedCount > 0 && (
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

              <span className="text-xs text-gray-500 font-semibold text-[#2bbab4]">
                {totalSelectedCount} selected
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
                Recreate ({totalSelectedCount}) as Type C
              </Button>
            </div>
          )}
        </div>

        {/* Data Table Body */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#2bbab4]" />
            </div>
          )}

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

        {/* Custom API Pagination Footer (Matches exact target image layout) */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white text-sm text-gray-600">
          {/* Left: Items per page & Total Range Display (e.g., 1-10 337) */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Ítems per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2bbab4]"
              >
                {[10, 20, 30].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-gray-500 font-medium ml-2">
              {totalItems > 0
                ? `${pageIndex * pageSize + 1}-${Math.min(
                    (pageIndex + 1) * pageSize,
                    totalItems,
                  )} ${totalItems}`
                : "0-0 0"}
            </div>
          </div>

          {/* Right: Interactive Page Input Jump & Navigation Arrows */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span>Page</span>
              <input
                type="text"
                value={pageInput}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputKeyDown}
                className="w-12 h-8 border border-gray-300 rounded-md text-center text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#2bbab4]"
              />
              <span className="font-medium text-gray-700">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(pageIndex - 1)}
                disabled={pageIndex === 0 || isLoading}
                className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(pageIndex + 1)}
                disabled={pageIndex + 1 >= totalPages || isLoading}
                className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
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
        selectedInvoices={batchSelectedInvoices}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  ChevronLeft,
  ChevronRight,
  Layers,
  Send,
} from "lucide-react";
import { ConsumerType, DispatchItem, DispatchStatus } from "./types";

interface DispatchTableProps {
  dispatches: DispatchItem[];
  onViewDetails: (dispatch: DispatchItem) => void;
}

type SortField = "id" | "consumer" | "rawDate" | "status";
type SortDirection = "asc" | "desc";

export function DispatchTable({
  dispatches,
  onViewDetails,
}: DispatchTableProps) {
  const [sortField, setSortField] = useState<SortField>("rawDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedDispatches = [...dispatches].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedDispatches.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDispatches = sortedDispatches.slice(startIndex, endIndex);

  // Consumer badge styling with distinct small colored dots
  const renderConsumerBadge = (consumer: ConsumerType) => {
    switch (consumer) {
      case "SAP QM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            SAP QM
          </span>
        );
      case "SAP MM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            SAP MM
          </span>
        );
      case "SAP PP":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            SAP PP
          </span>
        );
      case "Human Notification":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Human Notification
          </span>
        );
    }
  };

  // Status badge styling
  const renderStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case "Dispatched":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Dispatched
          </span>
        );
      case "Pending Approval":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Approval
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Rejected
          </span>
        );
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-emerald-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-400" />
    );
  };

  if (dispatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-[#0b0e14]/60 border border-white/[0.06] text-center">
        <Send className="w-12 h-12 text-zinc-600 mb-3 stroke-[1.5]" />
        <h4 className="text-sm font-semibold text-zinc-300 mb-1">
          Tidak Ada Tiket Dispatch yang Sesuai
        </h4>
        <p className="text-xs text-zinc-500 max-w-sm">
          Coba sesuaikan kata kunci pencarian atau filter status untuk menemukan tiket integrasi lainnya.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08] bg-[#07090e]/90 text-[11px] font-mono text-zinc-400 uppercase tracking-wider select-none">
              <th
                onClick={() => handleSort("id")}
                className="py-3.5 px-4 sm:px-6 font-semibold cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Dispatch ID</span>
                  {renderSortIcon("id")}
                </div>
              </th>
              <th
                onClick={() => handleSort("consumer")}
                className="py-3.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Consumer</span>
                  {renderSortIcon("consumer")}
                </div>
              </th>
              <th className="py-3.5 px-4 font-semibold">Trigger Reason</th>
              <th
                onClick={() => handleSort("rawDate")}
                className="py-3.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Tanggal</span>
                  {renderSortIcon("rawDate")}
                </div>
              </th>
              <th
                onClick={() => handleSort("status")}
                className="py-3.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>
              <th className="py-3.5 px-4 sm:px-6 font-semibold text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] text-xs font-sans">
            {currentDispatches.map((item) => (
              <tr
                key={item.id}
                className="transition-colors hover:bg-white/[0.035] group even:bg-white/[0.01]"
              >
                {/* Dispatch ID */}
                <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-white group-hover:text-emerald-300 transition-colors whitespace-nowrap">
                  {item.id}
                </td>

                {/* Consumer with Distinct Small Colored Dot */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {renderConsumerBadge(item.consumer)}
                </td>

                {/* Trigger Reason */}
                <td className="py-3.5 px-4 text-zinc-300 max-w-xs truncate font-medium">
                  <span title={item.triggerReason}>{item.triggerReason}</span>
                </td>

                {/* Tanggal */}
                <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                  {item.timestamp}
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {renderStatusBadge(item.status)}
                </td>

                {/* Aksi "Lihat" */}
                <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                  <button
                    onClick={() => onViewDetails(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-medium text-zinc-300 hover:text-emerald-300 bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-white/[0.06] bg-[#07090e]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-400">
        <div>
          Menampilkan <span className="text-white font-bold">{startIndex + 1}</span> -{" "}
          <span className="text-white font-bold">
            {Math.min(endIndex, sortedDispatches.length)}
          </span>{" "}
          dari <span className="text-white font-bold">{sortedDispatches.length}</span> data
        </div>

        <div className="flex items-center gap-2">
          {/* Previous Page Button */}
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page Number Indicators */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === page
                    ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          {/* Next Page Button */}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Halaman Selanjutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

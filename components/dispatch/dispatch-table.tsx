"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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

  // Consumer badge styling matching FlowDesk calm tokens
  const renderConsumerBadge = (consumer: ConsumerType) => {
    switch (consumer) {
      case "SAP QM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            SAP QM
          </span>
        );
      case "SAP MM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            SAP MM
          </span>
        );
      case "SAP PP":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            SAP PP
          </span>
        );
      case "Human Notification":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Human Notification
          </span>
        );
    }
  };

  // Status badge styling matching FlowDesk pastel status pills
  const renderStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case "Dispatched":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            Dispatched
          </span>
        );
      case "Pending Approval":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
            Pending Approval
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
            Rejected
          </span>
        );
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-slate-700" />
    ) : (
      <ArrowDown className="w-3 h-3 text-slate-700" />
    );
  };

  if (dispatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-white border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
          <Send className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h4 className="text-sm font-bold text-slate-900 mb-1">
          No Matching Dispatch Tickets
        </h4>
        <p className="text-xs text-slate-500 max-w-sm">
          Adjust your search keyword or status filters to view other ERP transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-sans">
              <th
                onClick={() => handleSort("id")}
                className="py-3.5 px-4 sm:px-6 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Dispatch ID</span>
                  {renderSortIcon("id")}
                </div>
              </th>
              <th
                onClick={() => handleSort("consumer")}
                className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Consumer ERP</span>
                  {renderSortIcon("consumer")}
                </div>
              </th>
              <th className="py-3.5 px-4">Trigger Reason</th>
              <th
                onClick={() => handleSort("rawDate")}
                className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Timestamp</span>
                  {renderSortIcon("rawDate")}
                </div>
              </th>
              <th
                onClick={() => handleSort("status")}
                className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>
              <th className="py-3.5 px-4 sm:px-6 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-sans">
            {currentDispatches.map((item, idx) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: 0.52 + idx * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ willChange: "transform, opacity" }}
                className="transition-colors hover:bg-slate-50/60 group even:bg-slate-50/20"
              >
                {/* Dispatch ID */}
                <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                  {item.id}
                </td>

                {/* Consumer with Small Colored Dot */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {renderConsumerBadge(item.consumer)}
                </td>

                {/* Trigger Reason */}
                <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate font-medium">
                  <span title={item.triggerReason}>{item.triggerReason}</span>
                </td>

                {/* Timestamp */}
                <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                  {item.timestamp}
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {renderStatusBadge(item.status)}
                </td>

                {/* Action Button */}
                <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                  <button
                    onClick={() => onViewDetails(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>View</span>
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-sans">
        <div>
          Showing <span className="text-slate-900 font-semibold">{startIndex + 1}</span> to{" "}
          <span className="text-slate-900 font-semibold">
            {Math.min(endIndex, sortedDispatches.length)}
          </span>{" "}
          of <span className="text-slate-900 font-semibold">{sortedDispatches.length}</span> entries
        </div>

        <div className="flex items-center gap-1.5">
          {/* Previous Page Button */}
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page Number Indicators */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentPage === page
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
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
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

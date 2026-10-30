"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Scan,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { DefectClass, InspectionRecord, InspectionStatus } from "./types";

interface HistoryTableProps {
  inspections: InspectionRecord[];
  onViewDetail: (record: InspectionRecord) => void;
  onExportCsv: () => void;
}

type SortField = "id" | "confidence" | "rawDate" | "status";
type SortDirection = "asc" | "desc";

export function HistoryTable({
  inspections,
  onViewDetail,
  onExportCsv,
}: HistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>("rawDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedRecords = [...inspections].sort((a, b) => {
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecords = sortedRecords.slice(startIndex, endIndex);

  // Defect Class Badge Styling (FlowDesk calm pill)
  const renderDefectBadge = (defectClass: DefectClass) => {
    if (defectClass === "OK" || defectClass === "ok") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Passed (OK)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Defect Detected
      </span>
    );
  };

  // Status Badge Styling (FlowDesk calm pill)
  const renderStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case "Passed":
      case "Lolos QC":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            Passed
          </span>
        );
      case "Held":
      case "Ditahan":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
            Held
          </span>
        );
      case "Pending Review":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
            Pending Review
          </span>
        );
      case "Rejected":
      case "Ditolak":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
            Rejected
          </span>
        );
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-slate-900" />
    ) : (
      <ArrowDown className="w-3 h-3 text-slate-900" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Top Header Bar Above Table */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Inspection Audit Trail
          </h2>
          <span className="text-xs text-slate-400 font-normal">
            ({inspections.length} Records)
          </span>
        </div>

        {/* Right-Aligned Export CSV Button */}
        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
          title="Export filtered records to CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Scan className="w-10 h-10 text-slate-300 mb-2 stroke-[1.5]" />
            <h4 className="text-sm font-semibold text-slate-800 mb-1">
              No Inspection Records Found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Try adjusting your date range, status, or defect class filters above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th
                    onClick={() => handleSort("id")}
                    className="py-3 px-4 sm:px-6 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Inspection ID</span>
                      {renderSortIcon("id")}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Frame</th>
                  <th className="py-3 px-4">Defect Class</th>
                  <th
                    onClick={() => handleSort("confidence")}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Confidence</span>
                      {renderSortIcon("confidence")}
                    </div>
                  </th>
                  <th className="py-3 px-4">Batch ID &amp; Component</th>
                  <th
                    onClick={() => handleSort("rawDate")}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Timestamp</span>
                      {renderSortIcon("rawDate")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("status")}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {renderSortIcon("status")}
                    </div>
                  </th>
                  <th className="py-3 px-4 sm:px-6 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentRecords.map((item, idx) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: 0.42 + idx * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ willChange: "transform, opacity" }}
                    className="transition-colors hover:bg-slate-50/60 group"
                  >
                    {/* 1. Inspection ID */}
                    <td className="py-3 px-4 sm:px-6 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {item.id}
                    </td>

                    {/* 2. Thumbnail Frame */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 p-0.5 flex items-center justify-center relative overflow-hidden mx-auto">
                        <div
                          className={`w-full h-full rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
                            item.defectClass === "OK"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.defectClass === "OK" ? "OK" : "DEF"}
                        </div>
                      </div>
                    </td>

                    {/* 3. Defect Class */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderDefectBadge(item.defectClass)}
                    </td>

                    {/* 4. Confidence % */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 tabular-nums">
                          {item.confidence !== null ? `${item.confidence.toFixed(1)}%` : "N/A"}
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full ${
                              (item.confidence ?? 0) >= 90
                                ? "bg-emerald-500"
                                : (item.confidence ?? 0) >= 75
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${item.confidence ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 5. Batch ID & Component */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-medium text-slate-900">
                          {item.batchId}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {item.partName}
                        </span>
                      </div>
                    </td>

                    {/* 6. Timestamp */}
                    <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                      {item.timestamp}
                    </td>

                    {/* 7. Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* 8. Action ("Inspect" button) */}
                    <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => onViewDetail(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination at Bottom */}
        {inspections.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="text-slate-900 font-semibold">{startIndex + 1}</span> to{" "}
              <span className="text-slate-900 font-semibold">
                {Math.min(endIndex, sortedRecords.length)}
              </span>{" "}
              of <span className="text-slate-900 font-semibold">{sortedRecords.length}</span> records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      currentPage === page
                        ? "bg-slate-900 text-white font-semibold shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

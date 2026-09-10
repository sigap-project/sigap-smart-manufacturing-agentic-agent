"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Layers,
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
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecords = sortedRecords.slice(startIndex, endIndex);

  // Defect Class Badge Styling
  const renderDefectBadge = (defectClass: DefectClass) => {
    if (defectClass === "OK" || defectClass === "ok") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          ok (Lolos QC)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        defect (Cacat)
      </span>
    );
  };

  // Status Badge Styling
  const renderStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case "Lolos QC":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Lolos QC
          </span>
        );
      case "Ditahan":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            Ditahan (Held)
          </span>
        );
      case "Pending Review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Pending Review
          </span>
        );
      case "Ditolak":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Ditolak
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

  return (
    <div className="space-y-4">
      {/* Top Header Bar Above Table: Count & Right-Aligned "Export CSV" Button */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <Scan className="w-3.5 h-3.5 text-emerald-400" />
            Riwayat Log Inspeksi
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            ({inspections.length} Rekaman)
          </span>
        </div>

        {/* Right-Aligned Export CSV Button (Outline style, download icon) */}
        <button
          onClick={onExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer shadow-sm"
          title="Ekspor riwayat terfilter ke format file CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="rounded-3xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Scan className="w-12 h-12 text-zinc-600 mb-3 stroke-[1.5]" />
            <h4 className="text-sm font-semibold text-zinc-300 mb-1">
              Tidak Ada Rekaman Riwayat Inspeksi
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm">
              Coba atur ulang filter tanggal, status, atau kelas cacat di bagian atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#07090e]/90 text-[11px] font-mono text-zinc-400 uppercase tracking-wider select-none">
                  <th
                    onClick={() => handleSort("id")}
                    className="py-3.5 px-4 sm:px-6 font-semibold cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Inspection ID</span>
                      {renderSortIcon("id")}
                    </div>
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-center">
                    Thumbnail
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Defect Class</th>
                  <th
                    onClick={() => handleSort("confidence")}
                    className="py-3.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Confidence</span>
                      {renderSortIcon("confidence")}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Batch ID</th>
                  <th
                    onClick={() => handleSort("rawDate")}
                    className="py-3.5 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Timestamp</span>
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
                {currentRecords.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-white/[0.035] group even:bg-white/[0.01]"
                  >
                    {/* 1. Inspection ID */}
                    <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-white group-hover:text-emerald-300 transition-colors whitespace-nowrap">
                      {item.id}
                    </td>

                    {/* 2. Thumbnail (Small square image placeholder) */}
                    <td className="py-3.5 px-3 whitespace-nowrap text-center">
                      <div className="w-10 h-10 rounded-xl bg-[#121622] border border-white/10 p-1 flex items-center justify-center relative overflow-hidden mx-auto group-hover:border-emerald-500/40 transition-colors">
                        <div
                          className={`w-full h-full rounded-lg flex items-center justify-center text-[9px] font-mono font-bold ${
                            item.defectClass === "OK"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {item.defectClass === "OK" ? "OK" : "DEF"}
                        </div>
                        {item.defectClass !== "OK" && (
                          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                        )}
                      </div>
                    </td>

                    {/* 3. Defect Class */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderDefectBadge(item.defectClass)}
                    </td>

                    {/* 4. Confidence % */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-200">
                          {item.confidence.toFixed(1)}%
                        </span>
                        <div className="w-14 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full ${
                              item.confidence >= 90
                                ? "bg-emerald-400"
                                : item.confidence >= 75
                                ? "bg-amber-400"
                                : "bg-rose-400"
                            }`}
                            style={{ width: `${item.confidence}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 5. Batch ID & Part */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-zinc-200">
                          {item.batchId}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-sans truncate max-w-[120px]">
                          {item.partName}
                        </span>
                      </div>
                    </td>

                    {/* 6. Timestamp */}
                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {item.timestamp}
                    </td>

                    {/* 7. Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* 8. Aksi ("Detail" link/button) */}
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => onViewDetail(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-medium text-zinc-300 hover:text-emerald-300 bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination at Bottom (Consistent with Export Dispatch) */}
        {inspections.length > 0 && (
          <div className="p-4 border-t border-white/[0.06] bg-[#07090e]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-400">
            <div>
              Menampilkan <span className="text-white font-bold">{startIndex + 1}</span> -{" "}
              <span className="text-white font-bold">
                {Math.min(endIndex, sortedRecords.length)}
              </span>{" "}
              dari <span className="text-white font-bold">{sortedRecords.length}</span> data
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

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
        )}
      </div>
    </div>
  );
}

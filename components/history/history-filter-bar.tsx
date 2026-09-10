"use client";

import { Search, Calendar, Filter, AlertTriangle, ChevronDown } from "lucide-react";
import { DefectClass, InspectionStatus } from "./types";

interface HistoryFilterBarProps {
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  statusFilter: InspectionStatus | "all";
  onStatusFilterChange: (status: InspectionStatus | "all") => void;
  defectFilter: DefectClass | "all";
  onDefectFilterChange: (defect: DefectClass | "all") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function HistoryFilterBar({
  dateRange,
  onDateRangeChange,
  statusFilter,
  onStatusFilterChange,
  defectFilter,
  onDefectFilterChange,
  searchQuery,
  onSearchChange,
}: HistoryFilterBarProps) {
  const dateRanges = [
    { id: "all", label: "Semua Waktu" },
    { id: "today", label: "Hari Ini" },
    { id: "7d", label: "7 Hari Terakhir" },
    { id: "30d", label: "30 Hari Terakhir" },
  ];

  const statuses: { id: InspectionStatus | "all"; label: string }[] = [
    { id: "all", label: "Semua Status" },
    { id: "Lolos QC", label: "Lolos QC (Passed)" },
    { id: "Ditahan", label: "Ditahan (Held)" },
    { id: "Pending Review", label: "Pending Review" },
    { id: "Ditolak", label: "Ditolak (Rejected)" },
  ];

  const defectClasses: { id: DefectClass | "all"; label: string }[] = [
    { id: "all", label: "Semua Hasil (defect & OK)" },
    { id: "defect", label: "defect (Cacat Terdeteksi)" },
    { id: "OK", label: "OK (Lolos QC)" },
  ];

  return (
    <div className="p-3 sm:p-4 rounded-2xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-lg mb-6">
      {/* All-In-One Horizontal Row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
        {/* 1. Date Range Picker Dropdown */}
        <div className="relative min-w-[150px]">
          <select
            value={dateRange}
            aria-label="Pilih Rentang Waktu Inspeksi"
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="w-full appearance-none pl-8 pr-8 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-zinc-300 font-medium hover:border-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
          >
            {dateRanges.map((d) => (
              <option key={d.id} value={d.id} className="bg-[#0b0e14] text-zinc-200">
                {d.label}
              </option>
            ))}
          </select>
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        </div>

        {/* 2. Status Filter Dropdown */}
        <div className="relative min-w-[160px]">
          <select
            value={statusFilter}
            aria-label="Filter Berdasarkan Status"
            onChange={(e) => onStatusFilterChange(e.target.value as InspectionStatus | "all")}
            className="w-full appearance-none pl-8 pr-8 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-zinc-300 font-medium hover:border-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#0b0e14] text-zinc-200">
                {s.label}
              </option>
            ))}
          </select>
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        </div>

        {/* 3. Defect-Class Filter Dropdown */}
        <div className="relative min-w-[170px]">
          <select
            value={defectFilter}
            aria-label="Filter Berdasarkan Kelas Cacat"
            onChange={(e) => onDefectFilterChange(e.target.value as DefectClass | "all")}
            className="w-full appearance-none pl-8 pr-8 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-zinc-300 font-medium hover:border-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer font-mono"
          >
            {defectClasses.map((df) => (
              <option key={df.id} value={df.id} className="bg-[#0b0e14] text-zinc-200">
                {df.label}
              </option>
            ))}
          </select>
          <AlertTriangle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        </div>

        {/* 4. Batch Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari Batch ID atau Komponen..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none text-zinc-200 placeholder:text-zinc-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

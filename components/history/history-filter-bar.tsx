"use client";

import { Search, Filter, AlertTriangle } from "lucide-react";
import { AnimatedSelect } from "@/components/ui/animated-select";
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
    { id: "all", label: "All Time" },
    { id: "today", label: "Today" },
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
  ];

  const statuses: { id: InspectionStatus | "all"; label: string }[] = [
    { id: "all", label: "All Statuses" },
    { id: "Passed", label: "Passed" },
    { id: "Held", label: "Held" },
    { id: "Pending Review", label: "Pending Review" },
    { id: "Rejected", label: "Rejected" },
  ];

  const defectClasses: { id: DefectClass | "all"; label: string }[] = [
    { id: "all", label: "All Defect Classes" },
    { id: "defect", label: "Defects Only" },
    { id: "OK", label: "OK (Passed)" },
  ];

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* 1. Date Range Segmented Pill Bar (FlowDesk [Daily] [Monthly] [Yearly] pattern) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/50 self-start lg:self-auto">
          {dateRanges.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDateRangeChange(d.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                dateRange === d.id
                  ? "bg-white text-slate-900 font-semibold shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Right Controls: Filters & Search */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 lg:justify-end">
          {/* 2. Status Filter Dropdown with Staggered Open Animation */}
          <AnimatedSelect
            value={statusFilter}
            onChange={(val) => onStatusFilterChange(val as InspectionStatus | "all")}
            options={statuses}
            icon={<Filter className="w-3.5 h-3.5" />}
            ariaLabel="Filter by Status"
            className="w-full sm:w-auto"
          />

          {/* 3. Defect-Class Filter Dropdown with Staggered Open Animation */}
          <AnimatedSelect
            value={defectFilter}
            onChange={(val) => onDefectFilterChange(val as DefectClass | "all")}
            options={defectClasses}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            ariaLabel="Filter by Defect Class"
            className="w-full sm:w-auto"
          />

          {/* 4. Batch Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Batch ID, Component, or Supplier..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 focus:outline-none text-slate-900 placeholder:text-slate-400 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

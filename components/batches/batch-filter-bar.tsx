"use client";

import { Search, Filter, ShieldCheck, Check, SlidersHorizontal } from "lucide-react";
import { AnimatedSelect } from "@/components/ui/animated-select";
import { BatchZone, BatchStatus } from "./types";

interface BatchFilterBarProps {
  activeZone: BatchZone;
  onZoneChange: (zone: BatchZone) => void;
  activeStatus: BatchStatus | "all";
  onStatusChange: (status: BatchStatus | "all") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  approvalModeOnly: boolean;
  onToggleApprovalMode: () => void;
  totalFiltered: number;
}

export function BatchFilterBar({
  activeZone,
  onZoneChange,
  activeStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  approvalModeOnly,
  onToggleApprovalMode,
  totalFiltered,
}: BatchFilterBarProps) {
  const zones: { id: BatchZone; label: string }[] = [
    { id: "all", label: "All Zones" },
    { id: "standard", label: "Standard Zone" },
    { id: "quarantine", label: "Quarantine Zone" },
  ];

  const statuses: { id: BatchStatus | "all"; label: string; color: string }[] = [
    { id: "all", label: "All Statuses", color: "text-slate-500" },
    { id: "pending", label: "Pending Review", color: "text-amber-600" },
    { id: "held", label: "Held (Quarantine)", color: "text-rose-600" },
    { id: "released", label: "Released", color: "text-emerald-600" },
    { id: "rejected", label: "Rejected", color: "text-slate-500" },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
      {/* Left: Zone Filter (Segmented Control) */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 overflow-x-auto">
        {zones.map((z) => {
          const isActive = activeZone === z.id;
          return (
            <button
              key={z.id}
              onClick={() => onZoneChange(z.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {z.label}
            </button>
          );
        })}
      </div>

      {/* Right Controls: Search, Status Dropdown, Approval Mode Toggle */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 sm:w-60 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search lot, product, supplier..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200/80 focus:bg-white focus:border-slate-400 focus:outline-none text-slate-800 placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Status Dropdown Selector with Staggered Open Animation */}
        <AnimatedSelect
          value={activeStatus}
          onChange={(val) => onStatusChange(val as BatchStatus | "all")}
          options={statuses.map((s) => ({ id: s.id, label: s.label }))}
          icon={<Filter className="w-3.5 h-3.5" />}
          ariaLabel="Filter By Batch Status"
        />

        {/* Approval Mode Toggle */}
        <button
          onClick={onToggleApprovalMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border cursor-pointer ${
            approvalModeOnly
              ? "bg-amber-50 border-amber-300/80 text-amber-700 shadow-xs"
              : "bg-slate-50 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="Filter batches requiring human-in-the-loop review"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              approvalModeOnly ? "bg-amber-500" : "bg-slate-400"
            }`}
          />
          <span>Approval Mode</span>
        </button>

        {/* Filtered Counter Badge */}
        <span className="text-xs text-slate-500 hidden xl:inline">
          Showing <span className="text-slate-900 font-semibold tabular-nums">{totalFiltered}</span> batches
        </span>
      </div>
    </div>
  );
}

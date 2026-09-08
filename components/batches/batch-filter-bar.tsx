"use client";

import { Search, Filter, ShieldCheck, ChevronDown, Check, SlidersHorizontal } from "lucide-react";
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
    { id: "all", label: "Semua Zona" },
    { id: "standard", label: "Zona Standar" },
    { id: "quarantine", label: "Zona Karantina" },
  ];

  const statuses: { id: BatchStatus | "all"; label: string; color: string }[] = [
    { id: "all", label: "Semua Status", color: "text-zinc-400" },
    { id: "pending", label: "Pending Review", color: "text-amber-400" },
    { id: "held", label: "Held (Karantina)", color: "text-rose-400" },
    { id: "released", label: "Released", color: "text-emerald-400" },
    { id: "rejected", label: "Rejected", color: "text-zinc-400" },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-lg mb-6">
      {/* Left: Zone Filter (Segmented Control) */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.06] overflow-x-auto">
        {zones.map((z) => {
          const isActive = activeZone === z.id;
          return (
            <button
              key={z.id}
              onClick={() => onZoneChange(z.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
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
        <div className="relative flex-1 sm:w-56 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari Batch ID / Produk..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black/40 border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none text-zinc-200 placeholder:text-zinc-500 transition-colors"
          />
        </div>

        {/* Status Dropdown Selector */}
        <div className="relative">
          <select
            value={activeStatus}
            aria-label="Filter Berdasarkan Status Batch"
            onChange={(e) => onStatusChange(e.target.value as BatchStatus | "all")}
            className="appearance-none pl-8 pr-8 py-1.5 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-zinc-300 font-medium hover:border-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
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

        {/* Approval Mode Toggle */}
        <button
          onClick={onToggleApprovalMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all duration-200 border cursor-pointer ${
            approvalModeOnly
              ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10"
              : "bg-black/30 border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20"
          }`}
          title="Filter hanya batch yang membutuhkan persetujuan human-in-the-loop"
        >
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              approvalModeOnly ? "bg-amber-400 animate-ping" : "bg-zinc-600"
            }`}
          />
          <span>Mode Approval</span>
        </button>

        {/* Filtered Counter Badge */}
        <span className="text-[11px] font-mono text-zinc-500 hidden xl:inline">
          Menampilkan <span className="text-white font-bold">{totalFiltered}</span> batch
        </span>
      </div>
    </div>
  );
}

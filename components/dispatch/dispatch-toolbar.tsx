"use client";

import { Search, Filter, Plus, ChevronDown, Layers } from "lucide-react";
import { ConsumerType, DispatchStatus } from "./types";

interface DispatchToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: DispatchStatus | "all";
  onStatusFilterChange: (status: DispatchStatus | "all") => void;
  consumerFilter: ConsumerType | "all";
  onConsumerFilterChange: (consumer: ConsumerType | "all") => void;
  onOpenCreateModal: () => void;
  totalFiltered: number;
}

export function DispatchToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  consumerFilter,
  onConsumerFilterChange,
  onOpenCreateModal,
  totalFiltered,
}: DispatchToolbarProps) {
  const statuses: { id: DispatchStatus | "all"; label: string }[] = [
    { id: "all", label: "Semua Status" },
    { id: "Dispatched", label: "Dispatched" },
    { id: "Pending Approval", label: "Pending Approval" },
    { id: "Rejected", label: "Rejected" },
  ];

  const consumers: { id: ConsumerType | "all"; label: string }[] = [
    { id: "all", label: "Semua Consumer" },
    { id: "SAP QM", label: "SAP QM (Quality)" },
    { id: "SAP MM", label: "SAP MM (Materials)" },
    { id: "SAP PP", label: "SAP PP (Production)" },
    { id: "Human Notification", label: "Human Notification" },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-lg mb-6">
      {/* Left / Center Controls: Search + Status Dropdown + Consumer Dropdown */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
        {/* Search Input */}
        <div className="relative flex-1 sm:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari Dispatch ID, Batch, atau Alasan..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none text-zinc-200 placeholder:text-zinc-500 transition-colors"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            aria-label="Filter Berdasarkan Status Dispatch"
            onChange={(e) => onStatusFilterChange(e.target.value as DispatchStatus | "all")}
            className="appearance-none pl-8 pr-8 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-zinc-300 font-medium hover:border-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
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

        {/* Consumer Filter Dropdown */}
        <div className="relative hidden sm:block">
          <select
            value={consumerFilter}
            aria-label="Filter Berdasarkan Consumer ERP"
            onChange={(e) => onConsumerFilterChange(e.target.value as ConsumerType | "all")}
            className="appearance-none pl-8 pr-8 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-zinc-300 font-medium hover:border-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
          >
            {consumers.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0b0e14] text-zinc-200">
                {c.label}
              </option>
            ))}
          </select>
          <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        </div>

        <span className="text-[11px] font-mono text-zinc-500 hidden xl:inline">
          {totalFiltered} Tiket
        </span>
      </div>

      {/* Right Aligned Solid Primary Button: + Dispatch Baru */}
      <button
        onClick={onOpenCreateModal}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/25 transition-all duration-200 cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>+ Dispatch Baru</span>
      </button>
    </div>
  );
}

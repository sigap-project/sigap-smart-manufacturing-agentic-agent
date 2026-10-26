"use client";

import { Search, Filter, Plus, Layers } from "lucide-react";
import { AnimatedSelect } from "@/components/ui/animated-select";
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
    { id: "all", label: "All Statuses" },
    { id: "Dispatched", label: "Dispatched" },
    { id: "Pending Approval", label: "Pending Approval" },
    { id: "Rejected", label: "Rejected" },
  ];

  const consumers: { id: ConsumerType | "all"; label: string }[] = [
    { id: "all", label: "All Consumers" },
    { id: "SAP QM", label: "SAP QM (Quality)" },
    { id: "SAP MM", label: "SAP MM (Materials)" },
    { id: "SAP PP", label: "SAP PP (Production)" },
    { id: "Human Notification", label: "Human Notification" },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
      {/* Left Controls: Search + Status Dropdown + Consumer Dropdown */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
        {/* Search Input */}
        <div className="relative flex-1 sm:min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Dispatch ID, Batch, Reason..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50/80 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-sans"
          />
        </div>

        {/* Status Filter Dropdown with Staggered Open Animation */}
        <AnimatedSelect
          value={statusFilter}
          onChange={(val) => onStatusFilterChange(val as DispatchStatus | "all")}
          options={statuses}
          icon={<Filter className="w-3.5 h-3.5" />}
          ariaLabel="Filter by Dispatch Status"
        />

        {/* Consumer Filter Dropdown with Staggered Open Animation */}
        <div className="hidden sm:block">
          <AnimatedSelect
            value={consumerFilter}
            onChange={(val) => onConsumerFilterChange(val as ConsumerType | "all")}
            options={consumers}
            icon={<Layers className="w-3.5 h-3.5" />}
            ariaLabel="Filter by ERP Consumer"
          />
        </div>

        <span className="text-[11px] font-medium text-slate-400 hidden xl:inline">
          {totalFiltered} Tickets
        </span>
      </div>

      {/* Right Aligned FlowDesk Style Dark Button: + New Dispatch */}
      <button
        onClick={onOpenCreateModal}
        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all duration-200 cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[2.2]" />
        <span>New Dispatch</span>
      </button>
    </div>
  );
}

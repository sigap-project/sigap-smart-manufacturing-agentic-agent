"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter } from "lucide-react";
import { AnimatedSelect } from "@/components/ui/animated-select";

export function DashboardPriorityItems() {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filterOptions = [
    { id: "all", label: "All Priority Lots" },
    { id: "critical", label: "Critical Escalation" },
    { id: "review", label: "Pending Review" },
    { id: "auto", label: "Auto-Store" },
  ];

  const priorityItems = [
    {
      lotId: "Lot #B-2026-0730",
      partName: "Bracket Motor A7",
      defectType: "Auto Quarantine • 45 pcs",
      escalationScore: "0.74",
      scoreColor: "text-rose-600",
      badge: "Critical",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200/70",
      code: "A7",
    },
    {
      lotId: "Lot #A-2026-0811",
      partName: "Housing Gearbox R2",
      defectType: "Pending Review • 28 pcs",
      escalationScore: "0.68",
      scoreColor: "text-amber-600",
      badge: "Elevated",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200/70",
      code: "HG",
    },
    {
      lotId: "Lot #C-2026-0902",
      partName: "Manifold Exhaust 4-Cyl",
      defectType: "QM Review • 16 pcs",
      escalationScore: "0.55",
      scoreColor: "text-blue-600",
      badge: "Review QM",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200/70",
      code: "ME",
    },
    {
      lotId: "Lot #B-2026-0728",
      partName: "Flange Pipe High-Temp",
      defectType: "Line Monitoring • 12 pcs",
      escalationScore: "0.42",
      scoreColor: "text-slate-600",
      badge: "Moderate",
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200/70",
      code: "FP",
    },
    {
      lotId: "Lot #D-2026-0914",
      partName: "Crankcase Valve Cap",
      defectType: "Scrap Disposition • 8 pcs",
      escalationScore: "0.38",
      scoreColor: "text-emerald-700",
      badge: "Auto-Store",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
      code: "CV",
    },
  ];

  const filteredItems = priorityItems.filter((item) => {
    const matchesQuery =
      item.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.lotId.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === "critical") return item.badge === "Critical";
    if (filter === "review") return item.badge === "Elevated" || item.badge === "Review QM";
    if (filter === "auto") return item.badge === "Auto-Store";
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.63, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
      className="rounded-2xl p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200"
    >
      {/* Header with Search and Filter (FlowDesk Recent Deals Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-sans text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Priority Action Items
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Component lots requiring QC supervisor evaluation and authorization
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search lot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 w-28 sm:w-36 transition-all"
            />
          </div>

          {/* Animated Select Dropdown */}
          <AnimatedSelect
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            icon={<Filter className="w-3.5 h-3.5" />}
            align="right"
            ariaLabel="Filter priority items"
          />
        </div>
      </div>

      {/* Priority Items List (FlowDesk Clean Table Row Style) */}
      <div className="space-y-2.5">
        {filteredItems.map((item, idx) => (
          <motion.div
            key={item.lotId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: 0.68 + idx * 0.05,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ willChange: "transform, opacity" }}
            className="p-3 rounded-xl bg-white hover:bg-slate-50/80 border border-slate-200/60 transition-colors flex items-center justify-between gap-3 group"
          >
            {/* Left: Avatar Thumbnail & Part Information */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center font-sans text-xs font-bold text-slate-700 shrink-0">
                {item.code}
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                  {item.partName}
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  {item.lotId} • {item.defectType}
                </span>
              </div>
            </div>

            {/* Right: Escalation Score Metric & Pastel Badge */}
            <div className="flex flex-col items-end shrink-0 gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400">
                  Score:
                </span>
                <span className={`text-xs sm:text-sm font-bold tabular-nums ${item.scoreColor}`}>
                  {item.escalationScore}
                </span>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ArrowUpRight, AlertCircle, ShieldAlert } from "lucide-react";

export function DashboardPriorityItems() {
  const [filter, setFilter] = useState("Hari Ini");

  const priorityItems = [
    {
      lotId: "Lot #B-2026-0730",
      partName: "Bracket Motor A7",
      defectType: "Retak Permukaan • 45 pcs",
      escalationScore: "0.74",
      scoreColor: "text-rose-400",
      badge: "CRITICAL",
      badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      code: "A7",
      bgCode: "bg-rose-950/40 border-rose-500/40 text-rose-300",
    },
    {
      lotId: "Lot #A-2026-0811",
      partName: "Housing Gearbox SME",
      defectType: "Lubang Gas • 28 pcs",
      escalationScore: "0.68",
      scoreColor: "text-amber-400",
      badge: "ELEVATED",
      badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      code: "HG",
      bgCode: "bg-amber-950/40 border-amber-500/40 text-amber-300",
    },
    {
      lotId: "Lot #C-2026-0902",
      partName: "Manifold Exhaust 4-Cyl",
      defectType: "Inklusi Pasir • 16 pcs",
      escalationScore: "0.55",
      scoreColor: "text-amber-300",
      badge: "REVIEW QM",
      badgeColor: "bg-amber-500/10 text-amber-200 border-amber-500/20",
      code: "ME",
      bgCode: "bg-teal-950/40 border-teal-500/40 text-teal-300",
    },
    {
      lotId: "Lot #B-2026-0728",
      partName: "Flange Pipe High-Temp",
      defectType: "Dimensi Minor • 12 pcs",
      escalationScore: "0.42",
      scoreColor: "text-cyan-400",
      badge: "MODERATE",
      badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
      code: "FP",
      bgCode: "bg-cyan-950/40 border-cyan-500/40 text-cyan-300",
    },
    {
      lotId: "Lot #D-2026-0914",
      partName: "Crankcase Valve Cap",
      defectType: "Penyusutan Sudut • 8 pcs",
      escalationScore: "0.38",
      scoreColor: "text-emerald-400",
      badge: "AUTO-STORE",
      badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      code: "CV",
      bgCode: "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
    },
  ];

  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
            Item Prioritas Pengawasan
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Daftar lot komponen yang membutuhkan evaluasi supervisor QC
          </p>
        </div>

        <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300 hover:border-emerald-500/30 transition-colors cursor-pointer">
          <span>{filter}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </div>
      </div>

      {/* Priority Items List (Matching Reference 'Top Dishes' Structure) */}
      <div className="space-y-3">
        {priorityItems.map((item, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all flex items-center justify-between gap-3 group"
          >
            {/* Left: Thumbnail Cube & Part Description */}
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Simulated Component Cube Preview with Micro Laser Pip */}
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center font-mono text-xs font-bold shrink-0 shadow-inner relative overflow-hidden ${item.bgCode}`}
              >
                <span>{item.code}</span>
                {/* Status pip */}
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {item.partName}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400 truncate">
                  {item.lotId} • {item.defectType}
                </span>
              </div>
            </div>

            {/* Right: Escalation Score Metric & Urgency Badge */}
            <div className="flex flex-col items-end shrink-0 gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-mono text-zinc-500">
                  Skor:
                </span>
                <span className={`font-mono text-xs sm:text-sm font-bold ${item.scoreColor}`}>
                  {item.escalationScore}
                </span>
              </div>
              <span
                className={`font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

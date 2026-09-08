"use client";

import { useState } from "react";
import { ChevronDown, ArrowUpRight, PieChart } from "lucide-react";

export function DashboardDefectDistribution() {
  const [filter, setFilter] = useState("Hari Ini");

  const defectClasses = [
    {
      name: "Retak Permukaan",
      desc: "Surface Cracks (Lot B)",
      count: 18,
      percent: 42.8,
      color: "from-rose-500 to-amber-500",
      dotColor: "bg-rose-400",
      textColor: "text-rose-400",
      stroke: "#f43f5e",
      strokeDasharray: "107 144",
      strokeDashoffset: "0",
    },
    {
      name: "Lubang Gas",
      desc: "Gas Porosity (Furnace)",
      count: 12,
      percent: 28.5,
      color: "from-cyan-500 to-blue-500",
      dotColor: "bg-cyan-400",
      textColor: "text-cyan-400",
      stroke: "#06b6d4",
      strokeDasharray: "71 180",
      strokeDashoffset: "-107",
    },
    {
      name: "Inklusi Pasir",
      desc: "Sand Inclusion (Molding)",
      count: 8,
      percent: 19.0,
      color: "from-emerald-500 to-teal-500",
      dotColor: "bg-emerald-400",
      textColor: "text-emerald-400",
      stroke: "#10b981",
      strokeDasharray: "47 204",
      strokeDashoffset: "-178",
    },
    {
      name: "Penyusutan",
      desc: "Shrinkage Cavity",
      count: 4,
      percent: 9.5,
      color: "from-violet-500 to-purple-500",
      dotColor: "bg-violet-400",
      textColor: "text-violet-400",
      stroke: "#8b5cf6",
      strokeDasharray: "24 227",
      strokeDashoffset: "-225",
    },
  ];

  const totalDefects = defectClasses.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
            Distribusi Cacat
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Proporsi 4 kelas anomali pengecoran
          </p>
        </div>

        <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300 hover:border-emerald-500/30 transition-colors cursor-pointer">
          <span>{filter}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </div>
      </div>

      {/* Donut Chart Visualization */}
      <div className="flex items-center justify-center my-2 relative">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Track Circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-white/[0.06]"
              strokeWidth="12"
              fill="transparent"
            />
            {/* 4 Segment Arcs */}
            {defectClasses.map((item, idx) => (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r="40"
                stroke={item.stroke}
                strokeWidth="12"
                strokeDasharray={item.strokeDasharray}
                strokeDashoffset={item.strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500 hover:opacity-80"
              />
            ))}
          </svg>

          {/* Center Readout Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="font-display text-3xl font-bold text-white tracking-tight">
              {totalDefects}
            </span>
            <span className="font-mono text-[10px] uppercase text-zinc-400 tracking-wider">
              Total Cacat
            </span>
          </div>
        </div>
      </div>

      {/* Legend Row List with colored dots & counts */}
      <div className="mt-4 space-y-2.5 pt-4 border-t border-white/[0.06]">
        {defectClasses.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full ${item.dotColor} shrink-0`} />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate">
                  {item.name}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono truncate">
                  {item.desc}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-xs font-bold text-white">
                {item.count} pcs
              </span>
              <span className={`font-mono text-[11px] font-medium ${item.textColor}`}>
                ({item.percent}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

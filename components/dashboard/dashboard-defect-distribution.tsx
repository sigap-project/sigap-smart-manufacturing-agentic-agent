"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface DefectDispositionItem {
  name: string;
  desc: string;
  count: number;
  percent: number;
  color: string;
  dotColor: string;
  textColor: string;
  stroke: string;
  strokeDasharray: string;
  strokeDashoffset: string;
}

interface DashboardDefectDistributionProps {
  disposition?: DefectDispositionItem[];
  totalDefects?: number;
}

const DEFAULT_DISPOSITION: DefectDispositionItem[] = [
  {
    name: "Karantina Otomatis",
    desc: "Tiket SAP QM terbit, lot dikunci",
    count: 22,
    percent: 52.4,
    color: "from-rose-500 to-amber-500",
    dotColor: "bg-rose-400",
    textColor: "text-rose-400",
    stroke: "#f43f5e",
    strokeDasharray: "131.6 119.7",
    strokeDashoffset: "0",
  },
  {
    name: "Pending Konfirmasi",
    desc: "Human-in-the-Loop SLA 10 mnt",
    count: 12,
    percent: 28.6,
    color: "from-amber-500 to-yellow-500",
    dotColor: "bg-amber-400",
    textColor: "text-amber-400",
    stroke: "#f59e0b",
    strokeDasharray: "71.8 179.5",
    strokeDashoffset: "-131.6",
  },
  {
    name: "Ditolak / Afkir",
    desc: "Disposisi scrap & tanur peleburan",
    count: 8,
    percent: 19.0,
    color: "from-purple-500 to-indigo-500",
    dotColor: "bg-purple-400",
    textColor: "text-purple-400",
    stroke: "#8b5cf6",
    strokeDasharray: "47.9 203.4",
    strokeDashoffset: "-203.4",
  },
];

export function DashboardDefectDistribution({
  disposition,
  totalDefects: propTotalDefects,
}: DashboardDefectDistributionProps) {
  const [filter, setFilter] = useState("Hari Ini");

  const items = disposition && disposition.length > 0 ? disposition : DEFAULT_DISPOSITION;
  const total = propTotalDefects !== undefined ? propTotalDefects : items.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
            Disposisi Cacat
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Status penanganan anomali defect terdeteksi
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
            {/* 3 Disposition Segment Arcs */}
            {items.map((item, idx) => (
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
              {total}
            </span>
            <span className="font-mono text-[10px] uppercase text-zinc-400 tracking-wider">
              Total Cacat
            </span>
          </div>
        </div>
      </div>

      {/* Legend Row List with colored dots & counts */}
      <div className="mt-4 space-y-2.5 pt-4 border-t border-white/[0.06]">
        {items.map((item, idx) => (
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

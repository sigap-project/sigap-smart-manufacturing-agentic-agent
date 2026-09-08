"use client";

import { useState } from "react";
import {
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  Activity,
} from "lucide-react";

export function DashboardTrendChart() {
  const [selectedFilter, setSelectedFilter] = useState("Hari Ini (Per Jam)");

  const hourlyData = [
    { time: "08:00", count: 2, isPeak: false },
    { time: "09:30", count: 4, isPeak: false },
    { time: "11:00", count: 3, isPeak: false },
    { time: "12:30", count: 5, isPeak: false },
    { time: "14:00", count: 12, isPeak: true }, // Peak hour matching reference's highlighted column
    { time: "15:30", count: 4, isPeak: false },
    { time: "17:00", count: 3, isPeak: false },
    { time: "18:30", count: 1, isPeak: false },
  ];

  const maxCount = 14;

  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Chart Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
              Tren Cacat Pengecoran
            </h3>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              LIVE SENSORS
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Distribusi anomali per jam sepanjang shift kerja konveyor
          </p>
        </div>

        {/* Action / Filter Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300 hover:border-emerald-500/30 transition-colors cursor-pointer">
            <span>{selectedFilter}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>

          <button
            aria-label="Perbesar Grafik"
            className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Detail Analitik"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chart Graphic Area (Custom SVG High-Tech Bar Chart matching reference photo) */}
      <div className="relative w-full h-56 sm:h-64 my-2 flex items-end justify-between gap-2 sm:gap-4 px-2 pt-10 pb-4 border-b border-white/[0.08]">
        {/* Background Horizontal Gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 z-0">
          <div className="border-b border-dashed border-white/40 w-full" />
          <div className="border-b border-dashed border-white/40 w-full" />
          <div className="border-b border-dashed border-white/40 w-full" />
          <div className="border-b border-dashed border-white/40 w-full" />
        </div>

        {/* Hourly Bars */}
        {hourlyData.map((item, idx) => {
          const heightPercent = (item.count / maxCount) * 100;
          return (
            <div
              key={idx}
              className="relative flex-1 flex flex-col items-center justify-end h-full group z-10"
            >
              {/* Peak Floating Tooltip Callout on 14:00 (Matching the reference photo's tooltip box) */}
              {item.isPeak && (
                <div className="absolute -top-12 z-20 flex flex-col items-center animate-bounce duration-1000">
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-950/95 border border-emerald-400 text-[10px] font-mono font-bold text-white shadow-xl shadow-emerald-950/80 flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>12 Cacat (Peak)</span>
                  </div>
                  {/* Arrow pip */}
                  <div className="w-2 h-2 bg-emerald-400 rotate-45 -mt-1" />
                </div>
              )}

              {/* Bar Container */}
              <div
                className={`w-full max-w-[48px] rounded-2xl transition-all duration-300 relative overflow-hidden flex items-end ${
                  item.isPeak
                    ? "bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30 border border-emerald-300/40"
                    : "bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06]"
                }`}
                style={{ height: `${heightPercent}%` }}
              >
                {/* Diagonal Scanline Texture for Bars (Matching reference visual texture) */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.06)_75%,transparent_75%,transparent)] bg-[size:10px_10px]" />

                {/* Top cap glow for peak */}
                {item.isPeak && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-white rounded-t-2xl shadow-sm shadow-white" />
                )}
              </div>

              {/* Time Label */}
              <span
                className={`mt-2 font-mono text-[10px] sm:text-[11px] tracking-tight ${
                  item.isPeak ? "text-emerald-400 font-bold" : "text-zinc-500"
                }`}
              >
                {item.time}
              </span>
            </div>
          );
        })}
      </div>

      {/* Highlighted Callout Box Below Chart (Peak-Value Deep Dive) */}
      <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-teal-950/30 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs sm:text-sm font-bold text-white">
                Analisis Jam Puncak: 14:00 - 15:00 WIB
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                SKOR 0.74
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
              3 anomali cacat permukaan berulang terdeteksi di Station #01. Agen otonom memicu eskalasi otomatis ke SAP QM &amp; MM.
            </p>
          </div>
        </div>

        <span className="shrink-0 font-mono text-xs text-emerald-400 font-semibold flex items-center gap-1">
          <Activity className="w-3.5 h-3.5" />
          Respon: 78ms
        </span>
      </div>
    </div>
  );
}

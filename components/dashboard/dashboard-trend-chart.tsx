"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface TrendPoint {
  label: string;
  total: number;
  defects: number;
}

export interface DefectTrend {
  hourly: TrendPoint[];
  daily: TrendPoint[];
}

interface DashboardTrendChartProps {
  trend?: DefectTrend;
}

const MODES = {
  Hourly: { key: "hourly", metricLabel: "Defects in last 12 hours", subtitle: "Defects per hour (WIB), from inspection records" },
  Daily: { key: "daily", metricLabel: "Defects in last 7 days", subtitle: "Defects per day (WIB), from inspection records" },
} as const;

export function DashboardTrendChart({ trend }: DashboardTrendChartProps) {
  const [selectedFilter, setSelectedFilter] = useState<keyof typeof MODES>("Hourly");
  const mode = MODES[selectedFilter];
  const data = trend?.[mode.key] ?? [];

  const totalDefects = data.reduce((sum, p) => sum + p.defects, 0);
  const totalInspected = data.reduce((sum, p) => sum + p.total, 0);
  const maxCount = Math.max(1, ...data.map((p) => p.defects));
  const peak = totalDefects > 0 ? data.reduce((a, b) => (b.defects > a.defects ? b : a)) : null;
  const yAxisTicks = [maxCount, Math.round(maxCount / 2), 0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
      className="rounded-2xl p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between"
    >
      {/* Chart Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-sans text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Casting Defect Trends
          </h3>
          <p className="text-xs text-slate-500 mt-1">{mode.subtitle}</p>

          <div className="flex items-baseline gap-3 mt-3">
            <span className="font-sans text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
              <AnimatedCounter value={totalDefects} duration={0.9} />
            </span>
            <span className="text-xs font-semibold text-slate-500">{mode.metricLabel}</span>
            <span className="text-[11px] font-medium text-slate-400 tabular-nums">
              of {totalInspected} inspected
            </span>
          </div>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200/70 text-xs font-medium text-slate-600">
          {(Object.keys(MODES) as Array<keyof typeof MODES>).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedFilter(m)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === m ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Bars */}
      <div className="relative w-full h-60 my-2 flex items-stretch gap-4 px-1 pt-6 pb-6 border-b border-slate-100">
        <div className="flex flex-col justify-between text-right pr-2 text-[11px] font-medium text-slate-400 shrink-0 h-full pb-6">
          {yAxisTicks.map((val, i) => (
            <span key={i} className="tabular-nums leading-none">
              {val}
            </span>
          ))}
        </div>

        <div className="relative flex-1 h-full pb-6">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 z-0">
            <div className="border-b border-dashed border-slate-200/80 w-full" />
            <div className="border-b border-dashed border-slate-200/80 w-full" />
            <div className="border-b border-solid border-slate-200 w-full" />
          </div>

          {data.length === 0 ? (
            <div className="relative z-10 h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              No inspection data yet.
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFilter}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full h-full flex items-end justify-between gap-1 sm:gap-3"
              >
                {data.map((item, idx) => {
                  const isPeak = peak !== null && item === peak;
                  const heightPercent = (item.defects / maxCount) * 100;
                  return (
                    <div
                      key={item.label + idx}
                      className="relative flex-1 flex flex-col items-center justify-end h-full group z-10"
                      title={`${item.label}: ${item.defects} defects / ${item.total} inspected`}
                    >
                      {item.defects > 0 && (
                        <span className="text-[10px] font-semibold text-slate-600 tabular-nums mb-1">
                          {item.defects}
                        </span>
                      )}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(heightPercent, item.total > 0 ? 2 : 0)}%` }}
                        transition={{ duration: 0.55, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        className={`w-full max-w-[44px] rounded-t-xl ${
                          isPeak ? "bg-blue-600 shadow-sm shadow-blue-500/30" : "bg-blue-400/75 hover:bg-blue-500"
                        }`}
                      />
                      <span
                        className={`absolute -bottom-6 font-sans text-[10px] sm:text-[11px] font-medium tracking-tight ${
                          isPeak ? "text-blue-600 font-bold" : "text-slate-500"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {peak && (
        <p className="mt-4 text-xs text-slate-600">
          Peak: <strong className="font-semibold text-slate-900">{peak.label}</strong> with{" "}
          <strong className="font-semibold text-slate-900">{peak.defects}</strong> defect(s) out of {peak.total}{" "}
          inspected.
        </p>
      )}
    </motion.div>
  );
}

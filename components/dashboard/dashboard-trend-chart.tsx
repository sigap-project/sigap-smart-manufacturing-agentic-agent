"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  ArrowUpRight,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export function DashboardTrendChart() {
  const [selectedFilter, setSelectedFilter] = useState<"Hourly" | "Daily" | "Weekly">("Hourly");

  const datasets = {
    Hourly: {
      data: [
        { label: "08:00", count: 2, isPeak: false },
        { label: "09:30", count: 4, isPeak: false },
        { label: "11:00", count: 3, isPeak: false },
        { label: "12:30", count: 5, isPeak: false },
        { label: "14:00", count: 12, isPeak: true },
        { label: "15:30", count: 4, isPeak: false },
        { label: "17:00", count: 3, isPeak: false },
        { label: "18:30", count: 1, isPeak: false },
      ],
      total: 29,
      metricLabel: "Total Shift Anomalies",
      delta: "+8% vs last shift",
      deltaPositive: false, // more defects is a negative trend in manufacturing
      subtitle: "Hourly anomaly distribution across active conveyor shift",
      maxCount: 14,
      yAxisTicks: [12, 8, 4, 0],
      peakLabel: "14:00 (Peak Shift)",
      peakCount: "12 pcs",
      threshold: "5 pcs",
      calloutTitle: "Peak Hour Analysis: 14:00 - 15:00 WIB",
      calloutDesc:
        "3 recurrent surface defect anomalies detected at Station #01. Autonomous agent triggered automatic escalation to SAP QM & MM.",
      score: "0.74",
      latency: "78ms",
    },
    Daily: {
      data: [
        { label: "Mon", count: 14, isPeak: false },
        { label: "Tue", count: 22, isPeak: false },
        { label: "Wed", count: 35, isPeak: true },
        { label: "Thu", count: 18, isPeak: false },
        { label: "Fri", count: 16, isPeak: false },
        { label: "Sat", count: 9, isPeak: false },
        { label: "Sun", count: 12, isPeak: false },
      ],
      total: 126,
      metricLabel: "Total 7-Day Anomalies",
      delta: "-5% vs last week",
      deltaPositive: true,
      subtitle: "Daily anomaly trend across past 7 operating days",
      maxCount: 40,
      yAxisTicks: [36, 24, 12, 0],
      peakLabel: "Wed (Foundry Heat #4)",
      peakCount: "35 pcs",
      threshold: "20 pcs",
      calloutTitle: "Peak Day Analysis: Wednesday (35 Defects)",
      calloutDesc:
        "Temperature variance during induction melt cycle #4 caused micro-porosity cluster. Auto-calibrated by thermal controller.",
      score: "0.82",
      latency: "62ms",
    },
    Weekly: {
      data: [
        { label: "W36", count: 120, isPeak: false },
        { label: "W37", count: 145, isPeak: false },
        { label: "W38", count: 110, isPeak: false },
        { label: "W39", count: 185, isPeak: true },
        { label: "W40", count: 130, isPeak: false },
        { label: "W41", count: 95, isPeak: false },
        { label: "W42", count: 105, isPeak: false },
      ],
      total: 890,
      metricLabel: "Total 7-Week Defect Volume",
      delta: "-14% vs previous cycle",
      deltaPositive: true,
      subtitle: "Weekly defect aggregation across metal casting cycles",
      maxCount: 200,
      yAxisTicks: [180, 120, 60, 0],
      peakLabel: "W39 (Scrap Batch Surge)",
      peakCount: "185 pcs",
      threshold: "100 pcs",
      calloutTitle: "Peak Week Analysis: Week 39 (185 Defects)",
      calloutDesc:
        "Vendor lot scrap impurity surge flagged in SAP MM. Supplier PT Krakatau Scrap put on UnderReview status.",
      score: "0.88",
      latency: "94ms",
    },
  };

  const current = datasets[selectedFilter];

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
          <div className="flex items-center gap-2">
            <h3 className="font-sans text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Casting Defect Trends
            </h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Live Sensor Feed</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 transition-all duration-300">
            {current.subtitle}
          </p>

          {/* Metric Highlight (FlowDesk style) with Animated Counter */}
          <div className="flex items-baseline gap-3 mt-3">
            <span className="font-sans text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
              <AnimatedCounter value={current.total} duration={0.9} />
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {current.metricLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                current.deltaPositive
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200/70"
                  : "text-rose-700 bg-rose-50 border-rose-200/70"
              }`}
            >
              {current.deltaPositive ? (
                <TrendingDown className="w-3 h-3 text-emerald-600" />
              ) : (
                <TrendingUp className="w-3 h-3 text-rose-600" />
              )}
              {current.delta}
            </span>
          </div>
        </div>

        {/* FlowDesk Segmented Buttons + Action Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200/70 text-xs font-medium text-slate-600">
            {(["Hourly", "Daily", "Weekly"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSelectedFilter(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedFilter === mode
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            aria-label="Expand Analytics Chart"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/70 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title="Analytics Details"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chart Graphic Area with Left Y-Axis & FlowDesk Soft Blue Bars */}
      <div className="relative w-full h-60 my-2 flex items-stretch gap-4 px-1 pt-12 pb-6 border-b border-slate-100">
        {/* Y-Axis Labels */}
        <div className="flex flex-col justify-between text-right pr-2 text-[11px] font-medium text-slate-400 shrink-0 h-full pb-6">
          {current.yAxisTicks.map((val) => (
            <span key={val} className="tabular-nums leading-none">
              {val}
            </span>
          ))}
        </div>

        {/* Chart Graphic Area with AnimatePresence for smooth transitions */}
        <div className="relative flex-1 h-full pb-6">
          {/* Background Horizontal Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 z-0">
            <div className="border-b border-dashed border-slate-200/80 w-full" />
            <div className="border-b border-dashed border-slate-200/80 w-full" />
            <div className="border-b border-dashed border-slate-200/80 w-full" />
            <div className="border-b border-solid border-slate-200 w-full" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedFilter}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full h-full flex items-end justify-between gap-2 sm:gap-4"
            >
              {current.data.map((item, idx) => {
                const heightPercent = Math.min(100, Math.max(8, (item.count / current.maxCount) * 100));
                return (
                  <div
                    key={item.label}
                    className="relative flex-1 flex flex-col items-center justify-end h-full group z-10"
                  >
                    {/* FlowDesk Floating Tooltip Callout on Peak bar */}
                    {item.isPeak && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
                        className="absolute -top-16 z-20 flex flex-col items-center pointer-events-none"
                      >
                        <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-md text-[11px] font-sans font-medium text-slate-800 flex flex-col gap-1 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 border-b border-slate-100 pb-0.5">
                            {current.peakLabel}
                          </span>
                          <div className="flex items-center justify-between gap-3 text-slate-600 text-[10px]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                              Defects
                            </span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {current.peakCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-slate-400 text-[10px]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-slate-300" />
                              Threshold
                            </span>
                            <span className="tabular-nums">
                              {current.threshold}
                            </span>
                          </div>
                        </div>
                        {/* Pip */}
                        <div className="w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45 -mt-1 shadow-2xs" />
                      </motion.div>
                    )}

                    {/* Bar Container */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPercent}%` }}
                      transition={{
                        duration: 0.55,
                        delay: idx * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`w-full max-w-[44px] rounded-t-xl transition-colors duration-200 relative overflow-hidden flex items-end ${
                        item.isPeak
                          ? "bg-blue-600 shadow-sm shadow-blue-500/30"
                          : "bg-blue-400/75 hover:bg-blue-500"
                      }`}
                    >
                      {item.isPeak && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 rounded-t-xl" />
                      )}
                    </motion.div>

                    {/* Label */}
                    <span
                      className={`absolute -bottom-6 font-sans text-[11px] font-medium tracking-tight ${
                        item.isPeak ? "text-blue-600 font-bold" : "text-slate-500"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Highlighted Callout Box Below Chart (FlowDesk Insights Style) */}
      <motion.div
        key={`callout-${selectedFilter}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 shrink-0 mt-0.5 sm:mt-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs sm:text-sm font-bold text-slate-900">
                {current.calloutTitle}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold tabular-nums">
                Score: {current.score}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {current.calloutDesc}
            </p>
          </div>
        </div>

        <span className="shrink-0 text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70">
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span>Response: <strong className="font-semibold text-slate-800">{current.latency}</strong></span>
        </span>
      </motion.div>
    </motion.div>
  );
}

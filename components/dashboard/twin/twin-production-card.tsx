"use client";

import { motion } from "framer-motion";
import {
  TrendingDown,
  AlertTriangle,
  Send,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";
import { TwinRadialGauge } from "./twin-radial-gauge";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface TwinProductionCardProps {
  totalInspections?: number;
  activeLotId?: string;
  defectRate?: number;
  batchesHeldCount?: number;
  heldDefectPcs?: number;
  dispatchesCount?: number;
  dpmo?: number;
  firstPassYieldPct?: number;
}

export function TwinProductionCard({
  totalInspections = 1428,
  activeLotId = "#B-2026-0730",
  defectRate = 0.56,
  batchesHeldCount = 3,
  heldDefectPcs = 36,
  dispatchesCount = 18,
  dpmo,
  firstPassYieldPct,
}: TwinProductionCardProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Hero Production & OEE Radial Gauge Card (FlowDesk Minimalist Light Card) */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">
              QC Production Summary
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 font-medium">
              HPDC #02
            </span>
          </div>
          <button
            aria-label="Card Options"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Tone Radial Gauge for OEE */}
        <div className="flex items-center justify-center my-1">
          <TwinRadialGauge
            value={89.4}
            size={148}
            strokeWidth={9}
            label="OEE Efficiency"
            sublabel="Target: 85.0%"
            accentColor="#10B981"
            trackColor="#F1F5F9"
            showTicks={true}
          />
        </div>

        {/* 3 FlowDesk Bottom Mini Stat Cards */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center mt-1">
          <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              INSPECTIONS
            </p>
            <p className="text-xs font-bold text-slate-800 mt-0.5 tabular-nums">
              <AnimatedCounter value={totalInspections} duration={1.2} />
            </p>
          </div>
          <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              ACTIVE LOT
            </p>
            <p className="text-[11px] font-bold text-slate-700 mt-0.5 truncate font-mono">
              {activeLotId.replace("#B-", "")}
            </p>
          </div>
          <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <p
              className="text-[10px] text-slate-400 font-medium uppercase tracking-wider"
              title="Defects per million units (1 opportunity/unit). Six Sigma target: 3.4"
            >
              DPMO
            </p>
            <p className="text-[11px] font-bold text-slate-800 mt-0.5 tabular-nums">
              {dpmo !== undefined ? dpmo.toLocaleString("en-US") : "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* 2. Grid of 3 Separate Modular Cards — Pure FlowDesk Style (Label + ... + Big Number + Delta) */}
      <div className="flex flex-col gap-2">
        {/* Card A: Defect Rate KPI Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "transform, opacity" }}
          className="rounded-2xl p-4 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500">
              Defect Rate
            </span>
            <button
              aria-label="Options"
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-2 my-0.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums font-sans">
              <AnimatedCounter value={defectRate} decimals={2} suffix="%" duration={1.2} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium pt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              {firstPassYieldPct !== undefined
                ? `First-pass yield ${firstPassYieldPct}% • Six Sigma target 3.4 DPMO`
                : "Normal • Below 1.5% threshold"}
            </span>
          </div>
        </motion.div>

        {/* Card B: Held Batches & Quarantine */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.29, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "transform, opacity" }}
          className="rounded-2xl p-4 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500">
              Held Batches
            </span>
            <button
              aria-label="Options"
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums font-sans">
              <AnimatedCounter value={batchesHeldCount} duration={1.0} />
            </span>
            <span className="text-xs font-medium text-slate-400">
              Lots
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium pt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{heldDefectPcs} pcs anomalies • Authorization required</span>
          </div>
        </motion.div>

        {/* Card C: SAP Integration Dispatch */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "transform, opacity" }}
          className="rounded-2xl p-4 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500">
              SAP ERP Dispatch
            </span>
            <button
              aria-label="Options"
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums font-sans">
              <AnimatedCounter value={dispatchesCount} duration={1.0} />
            </span>
            <span className="text-xs font-medium text-slate-400">
              Actions
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium pt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>100% Synced OData QM/MM/PP</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

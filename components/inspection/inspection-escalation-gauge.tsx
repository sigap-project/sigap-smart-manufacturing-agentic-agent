"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, Zap, Info } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface InspectionEscalationGaugeProps {
  score?: number;
  lotId?: string;
  partName?: string;
}

export function InspectionEscalationGauge({
  score: initialScore = 0.74,
  lotId = "Lot #B-2026-0730",
  partName = "Bracket Motor A7",
}: InspectionEscalationGaugeProps) {
  const [currentScore, setCurrentScore] = useState<number>(initialScore);

  useEffect(() => {
    setCurrentScore(initialScore);
  }, [initialScore]);

  // Sinkronisasi realtime via Server-Sent Events (SSE)
  useSigapEvents({
    onBatchStatusChanged: (data) => {
      if (typeof data.escalationScore === "number") {
        setCurrentScore(data.escalationScore);
      }
    },
    onInspectionCreated: (data) => {
      if (typeof data.escalationScore === "number") {
        setCurrentScore(data.escalationScore);
      }
    },
    onAgentLog: (data) => {
      if (typeof data.escalationScore === "number") {
        setCurrentScore(data.escalationScore);
      }
    },
  });

  // Score percentage position (0 to 100)
  const scorePercent = Math.min(100, Math.max(0, currentScore * 100));

  // Determine active level
  const isLevel3 = currentScore >= 0.70;
  const isLevel2 = currentScore >= 0.40 && currentScore < 0.70;
  const isLevel1 = currentScore < 0.40;

  return (
    <div className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      {/* Top Header: Title, Active Lot & Score Metric */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-sans text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Batch Escalation Risk Index
            </h3>
            {isLevel3 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Level 3 Triggered
              </span>
            )}
            {isLevel2 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Elevated Risk
              </span>
            )}
            {isLevel1 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Normal Sporadic
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lotId} • {partName}
          </p>
        </div>

        {/* Big Score Readout */}
        <div className="flex items-baseline gap-2 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/70 shrink-0 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-medium">Active Score:</span>
          <span
            className={`font-sans text-xl sm:text-2xl font-extrabold tabular-nums transition-colors ${
              isLevel3 ? "text-rose-600" : isLevel2 ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            <AnimatedCounter value={currentScore} decimals={2} duration={1.2} />
          </span>
          <span className="text-xs text-slate-400 font-normal">/ 1.00</span>
        </div>
      </div>

      {/* Horizontal Multi-Zone Bar Track */}
      <div className="relative pt-6 pb-2">
        {/* Floating Indicator Pin / Needle positioned at scorePercent */}
        <motion.div
          initial={{ left: "0%" }}
          animate={{ left: `${scorePercent}%` }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "left" }}
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-20"
        >
          <div
            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold shadow-sm whitespace-nowrap flex items-center gap-1.5 transition-colors text-white ${
              isLevel3
                ? "bg-rose-600"
                : isLevel2
                ? "bg-amber-500"
                : "bg-emerald-600"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>{currentScore.toFixed(2)} (Active)</span>
          </div>
          <div
            className={`w-2 h-2 rotate-45 -mt-1 shadow-2xs transition-colors ${
              isLevel3 ? "bg-rose-600" : isLevel2 ? "bg-amber-500" : "bg-emerald-600"
            }`}
          />
        </motion.div>

        {/* The 3 Segmented Zones Meter */}
        <div className="w-full h-3 rounded-full overflow-hidden flex p-[1.5px] bg-slate-100 border border-slate-200/80 shadow-inner">
          {/* Zone 1: Sporadic (0 - 0.40) -> 40% */}
          <div
            className="h-full rounded-l-full bg-emerald-500 relative group"
            style={{ width: "40%" }}
            title="Sporadic Zone (<0.40): Workpiece Auto-Stored"
          />

          {/* Zone 2: Elevated (0.40 - 0.70) -> 30% */}
          <div
            className="h-full bg-amber-500 border-x border-white/40 relative group"
            style={{ width: "30%" }}
            title="Elevated Zone (0.40-0.70): Auto-Store + SAP QM Notification"
          />

          {/* Zone 3: Pattern Confirmed (>0.70) -> 30% */}
          <div
            className="h-full rounded-r-full bg-rose-500 relative group"
            style={{ width: "30%" }}
            title="Pattern Confirmed Zone (>0.70): Full Autonomous Escalation (QM + MM + PP)"
          />
        </div>

        {/* Zone Markers / Threshold Lines */}
        <div className="relative w-full flex justify-between mt-2 text-[11px] font-medium text-slate-400 tabular-nums">
          <span>0.00</span>
          <span className="text-emerald-700 font-semibold">0.40 (Sporadic Threshold)</span>
          <span className="text-rose-700 font-semibold">0.70 (Critical Threshold)</span>
          <span>1.00</span>
        </div>
      </div>

      {/* 3 Labeled Zone Action Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-slate-100">
        {/* Zone 1 Box */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
            isLevel1
              ? "bg-emerald-50/70 border-emerald-300 shadow-2xs"
              : "bg-slate-50/60 border-slate-200/60 opacity-80"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-800">
              &lt; 0.40 • Sporadic
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Isolated random defect. Workpiece routed to auto-store bin without ERP escalation.
          </p>
        </div>

        {/* Zone 2 Box */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
            isLevel2
              ? "bg-amber-50/70 border-amber-300 shadow-2xs"
              : "bg-slate-50/60 border-slate-200/60 opacity-80"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-800">
              0.40–0.70 • Elevated
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Frequency surge detected. Workpiece diverted to auto-store + quality notification logged to SAP QM.
          </p>
        </div>

        {/* Zone 3 Box */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all relative ${
            isLevel3
              ? "bg-rose-50/70 border-rose-300 shadow-2xs"
              : "bg-slate-50/60 border-slate-200/60 opacity-80"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              {isLevel3 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              &gt; 0.70 • Confirmed
            </span>
            <Zap className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            Systemic pattern confirmed. Auto-store diverter + SAP QM ticket + SAP MM UnderReview vendor flag + SAP PP reschedule.
          </p>
        </div>
      </div>

      {/* Formula Footnote */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Formula: E = (Frequency &times; 0.40) + (Severity &times; 0.35) + (History &times; 0.25)</span>
        </div>
        <span className="hidden sm:inline text-blue-600 font-semibold">Autonomous AWS Bedrock Reasoning</span>
      </div>
    </div>
  );
}

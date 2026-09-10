"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, ShieldCheck, Zap, Info } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

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
    <div className="rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40">
      {/* Top Header: Title, Active Lot & Score Metric */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
              Indikator Skor Eskalasi Batch
            </h3>
            {isLevel3 && (
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                LEVEL 3 TRIGGERED
              </span>
            )}
            {isLevel2 && (
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ELEVATED RISK
              </span>
            )}
            {isLevel1 && (
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                SPORADIS NORMAL
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
            {lotId} • {partName}
          </p>
        </div>

        {/* Big Score Readout */}
        <div className="flex items-baseline gap-2 bg-white/[0.03] px-3.5 py-1.5 rounded-2xl border border-white/[0.08] shrink-0 self-start sm:self-auto">
          <span className="text-xs text-zinc-400 font-mono">Skor Aktif:</span>
          <span
            className={`font-display text-xl sm:text-2xl font-bold transition-colors ${
              isLevel3 ? "text-rose-400" : isLevel2 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {currentScore.toFixed(2)}
          </span>
          <span className="text-[10px] font-mono text-zinc-500">/ 1.00</span>
        </div>
      </div>

      {/* Horizontal Multi-Zone Bar Track */}
      <div className="relative pt-6 pb-2">
        {/* Floating Indicator Pin / Needle positioned at scorePercent */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-700 ease-out z-20"
          style={{ left: `${scorePercent}%` }}
        >
          <div
            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shadow-lg whitespace-nowrap flex items-center gap-1 transition-colors ${
              isLevel3
                ? "bg-rose-500 text-zinc-950 shadow-rose-500/40"
                : isLevel2
                ? "bg-amber-500 text-zinc-950 shadow-amber-500/40"
                : "bg-emerald-500 text-zinc-950 shadow-emerald-500/40"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-ping" />
            <span>{currentScore.toFixed(2)} (Aktif)</span>
          </div>
          <div
            className={`w-2 h-2 rotate-45 -mt-1 shadow-sm transition-colors ${
              isLevel3 ? "bg-rose-500" : isLevel2 ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
        </div>

        {/* The 3 Segmented Zones Meter */}
        <div className="w-full h-4 rounded-full overflow-hidden flex p-[2px] bg-black/50 border border-white/10 shadow-inner">
          {/* Zone 1: Sporadis (0 - 0.40) -> 40% */}
          <div
            className="h-full rounded-l-full bg-gradient-to-r from-emerald-600 to-emerald-400 relative group"
            style={{ width: "40%" }}
            title="Zona Sporadis (<0.40): Auto-Store Fisik"
          />

          {/* Zone 2: Elevated (0.40 - 0.70) -> 30% */}
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 border-x border-black/40 relative group"
            style={{ width: "30%" }}
            title="Zona Elevated (0.40-0.70): Store + Notifikasi SAP QM"
          />

          {/* Zone 3: Pattern Confirmed (>0.70) -> 30% */}
          <div
            className="h-full rounded-r-full bg-gradient-to-r from-rose-500 to-red-600 relative group"
            style={{ width: "30%" }}
            title="Zona Pattern Confirmed (>0.70): Eskalasi Otonom Penuh (QM + MM + PP)"
          />
        </div>

        {/* Zone Markers / Threshold Lines */}
        <div className="relative w-full flex justify-between mt-2 text-[10px] font-mono text-zinc-500">
          <span>0.00</span>
          <span className="text-emerald-400">0.40 (Ambang Sporadis)</span>
          <span className="text-amber-400">0.70 (Ambang Kritis)</span>
          <span>1.00</span>
        </div>
      </div>

      {/* 3 Labeled Zone Action Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-white/[0.06]">
        {/* Zone 1 Box */}
        <div
          className={`p-3 rounded-2xl border flex flex-col justify-between transition-all ${
            isLevel1
              ? "bg-emerald-500/[0.12] border-emerald-500/40 shadow-sm shadow-emerald-950/40 ring-1 ring-emerald-500/30"
              : "bg-emerald-500/[0.04] border-emerald-500/15 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase">
              &lt; 0.40 • Sporadis
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug">
            Cacat acak non-pola. Komponen dialihkan ke penyimpanan auto-store tanpa eskalasi bisnis.
          </p>
        </div>

        {/* Zone 2 Box */}
        <div
          className={`p-3 rounded-2xl border flex flex-col justify-between transition-all ${
            isLevel2
              ? "bg-amber-500/[0.12] border-amber-500/40 shadow-sm shadow-amber-950/40 ring-1 ring-amber-500/30"
              : "bg-amber-500/[0.04] border-amber-500/15 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] font-bold text-amber-400 uppercase">
              0.40–0.70 • Elevated
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug">
            Frekuensi meningkat. Auto-store komponen + penerbitan tiket notifikasi kualitas ke SAP QM.
          </p>
        </div>

        {/* Zone 3 Box */}
        <div
          className={`p-3 rounded-2xl border flex flex-col justify-between transition-all relative ${
            isLevel3
              ? "bg-rose-500/[0.12] border-rose-500/40 shadow-sm shadow-rose-950/40 ring-1 ring-rose-500/30"
              : "bg-rose-500/[0.04] border-rose-500/15 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] font-bold text-rose-300 uppercase flex items-center gap-1">
              {isLevel3 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
              &gt; 0.70 • Confirmed
            </span>
            <Zap className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-[11px] text-zinc-300 leading-snug">
            Pola sistemik. Auto-store + tiket SAP QM + flag UnderReview di SAP MM + usulan reschedule SAP PP.
          </p>
        </div>
      </div>

      {/* Formula Footnote */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Info className="w-3 h-3 text-emerald-400" />
          <span>Formula: E = (Frekuensi &times; 0.40) + (Severity &times; 0.35) + (Histori &times; 0.25)</span>
        </div>
        <span className="hidden sm:inline text-emerald-400">Penalaran Otonom AWS Bedrock</span>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  Check,
  X,
  Clock,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Layers,
  ArrowRight,
} from "lucide-react";
import { BatchItem } from "./types";

interface BatchApprovalPanelProps {
  pendingBatches: BatchItem[];
  onApprove: (batchId: string) => void;
  onReject: (batchId: string) => void;
  onInspectBatch: (batch: BatchItem) => void;
}

export function BatchApprovalPanel({
  pendingBatches,
  onApprove,
  onReject,
  onInspectBatch,
}: BatchApprovalPanelProps) {
  // Live SLA timers simulation: track countdown seconds for each batch
  const [timers, setTimers] = useState<{ [batchId: string]: number }>({});

  useEffect(() => {
    // Initialize timers from batch data
    const initialTimers: { [batchId: string]: number } = {};
    pendingBatches.forEach((b) => {
      initialTimers[b.id] = b.slaSeconds || 600;
    });
    setTimers(initialTimers);

    const interval = setInterval(() => {
      setTimers((prev) => {
        const next: { [batchId: string]: number } = {};
        Object.entries(prev).forEach(([id, sec]) => {
          next[id] = sec > 0 ? sec - 1 : 0;
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingBatches.length]);

  const formatSla = (seconds: number | undefined) => {
    if (seconds === undefined) return "10m 00s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}m ${secs
      .toString()
      .padStart(2, "0")}s`;
  };

  return (
    <div className="rounded-3xl bg-[#0b0e14]/85 backdrop-blur-xl border border-white/[0.08] shadow-2xl p-5 sm:p-6 flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Menunggu Persetujuan
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pendingBatches.length} Antrean
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400 font-sans">
              Keputusan manual supervisor (Human-in-the-Loop)
            </p>
          </div>
        </div>
      </div>

      {/* Stacked Approval List */}
      <div className="flex-1 space-y-3.5 overflow-y-auto pr-0.5">
        {pendingBatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center my-auto">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2.5">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="text-xs font-semibold text-zinc-200 mb-1">
              Semua Keputusan Selesai!
            </h4>
            <p className="text-[11px] text-zinc-500">
              Tidak ada batch yang membutuhkan review manual saat ini.
            </p>
          </div>
        ) : (
          pendingBatches.map((batch) => {
            const currentSeconds = timers[batch.id] ?? (batch.slaSeconds || 600);
            const isUrgent = currentSeconds < 300; // less than 5 minutes

            return (
              <div
                key={batch.id}
                className="relative rounded-2xl p-4 bg-gradient-to-b from-[#10141d] to-[#0d1017] border border-amber-500/25 hover:border-amber-500/40 shadow-md transition-all duration-200 group flex flex-col justify-between gap-3"
              >
                {/* Header: Batch ID, Part Name & SLA Timer */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {batch.id}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="font-sans text-xs font-medium text-zinc-300 truncate max-w-[140px] sm:max-w-[180px]">
                        {batch.productName}
                      </span>
                    </div>

                    {/* Small Countdown SLA Timer */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border ${
                        isUrgent
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/25"
                      }`}
                      title="Sisa waktu respon sebelum auto-escalation ke Plant Manager"
                    >
                      <Clock className="w-3 h-3" />
                      <span>SLA: {formatSla(currentSeconds)}</span>
                    </div>
                  </div>

                  {/* Defect Summary Line */}
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed line-clamp-2 mb-2.5">
                    {batch.defectSummary ||
                      `${batch.defectCount} anomali terdeteksi pada inspeksi optik konveyor.`}
                  </p>

                  {/* Escalation Score Badge */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Formula Score:
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          (batch.escalationScore ?? 0) >= 0.7
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : (batch.escalationScore ?? 0) >= 0.4
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {(batch.escalationScore ?? 0).toFixed(2)} •{" "}
                        {(batch.escalationScore ?? 0) >= 0.7
                          ? "Pattern Confirmed"
                          : "Elevated"}
                      </span>
                    </div>

                    <button
                      onClick={() => onInspectBatch(batch)}
                      className="text-[10px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      Detail
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {/* Two Action Buttons: "Setujui" (Green) and "Tolak" (Outline/Red) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Tolak Button */}
                  <button
                    onClick={() => onReject(batch.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-400 transition-all duration-200 cursor-pointer"
                    title="Tahan lot ke Zona Karantina dan teruskan tiket ke SAP QM"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Tolak</span>
                  </button>

                  {/* Setujui Button */}
                  <button
                    onClick={() => onApprove(batch.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all duration-200 cursor-pointer"
                    title="Setujui batch dan lepaskan lot untuk perakitan/pengiriman"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Setujui</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footnote Guide */}
      <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>SAP QM Dispatch: Otomatis saat Tolak</span>
        <span>Supervisor Line #02</span>
      </div>
    </div>
  );
}

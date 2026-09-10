"use client";

import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  XCircle,
  Clock,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { BatchItem, BatchStatus } from "./types";

interface BatchGridBoardProps {
  batches: BatchItem[];
  selectedBatch: BatchItem | null;
  onSelectBatch: (batch: BatchItem) => void;
}

export function BatchGridBoard({
  batches,
  selectedBatch,
  onSelectBatch,
}: BatchGridBoardProps) {
  const getStatusConfig = (status: BatchStatus | string) => {
    switch (status) {
      case "pending":
      case "pending_review":
        return {
          borderColor: "border-amber-500/40 hover:border-amber-400",
          selectedRing: "ring-2 ring-amber-400/80 shadow-amber-500/20",
          bgColor: "bg-amber-500/[0.03]",
          badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          label: "Pending Review",
          icon: Clock,
          accentDot: "bg-amber-400",
        };
      case "held":
      case "hold":
        return {
          borderColor: "border-rose-500/45 hover:border-rose-400",
          selectedRing: "ring-2 ring-rose-400/80 shadow-rose-500/20",
          bgColor: "bg-rose-500/[0.03]",
          badgeBg: "bg-rose-500/15 text-rose-300 border-rose-500/30",
          label: "Held (Karantina)",
          icon: ShieldAlert,
          accentDot: "bg-rose-400 animate-pulse",
        };
      case "released":
      case "approved":
        return {
          borderColor: "border-emerald-500/30 hover:border-emerald-400/70",
          selectedRing: "ring-2 ring-emerald-400/80 shadow-emerald-500/20",
          bgColor: "bg-emerald-500/[0.02]",
          badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          label: "Released",
          icon: CheckCircle2,
          accentDot: "bg-emerald-400",
        };
      case "rejected":
      case "scrap":
        return {
          borderColor: "border-zinc-800 hover:border-zinc-700",
          selectedRing: "ring-2 ring-zinc-500/60 shadow-black",
          bgColor: "bg-zinc-900/30",
          badgeBg: "bg-zinc-800/80 text-zinc-400 border-zinc-700",
          label: "Rejected",
          icon: XCircle,
          accentDot: "bg-zinc-500",
        };
      default:
        return {
          borderColor: "border-amber-500/30 hover:border-amber-400/50",
          selectedRing: "ring-2 ring-amber-400/80 shadow-amber-500/20",
          bgColor: "bg-amber-500/[0.03]",
          badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          label: status || "Pending Review",
          icon: Clock,
          accentDot: "bg-amber-400",
        };
    }
  };

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-[#0b0e14]/60 border border-white/[0.06] text-center">
        <Layers className="w-12 h-12 text-zinc-600 mb-3 stroke-[1.5]" />
        <h4 className="text-sm font-semibold text-zinc-300 mb-1">
          Tidak Ada Batch yang Sesuai
        </h4>
        <p className="text-xs text-zinc-500 max-w-sm">
          Coba sesuaikan filter zona manufaktur atau kata kunci pencarian Anda untuk melihat batch lainnya.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
      {batches.map((batch) => {
        const config = getStatusConfig(batch.status);
        const StatusIcon = config?.icon || Clock;
        const isSelected = selectedBatch?.id === batch.id;

        return (
          <div
            key={batch.id}
            onClick={() => onSelectBatch(batch)}
            className={`group relative rounded-2xl p-4 sm:p-4.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between backdrop-blur-md shadow-lg hover:-translate-y-1 hover:shadow-xl ${
              config.borderColor
            } ${config.bgColor} ${
              isSelected
                ? `${config.selectedRing} bg-white/[0.04]`
                : "hover:bg-white/[0.03]"
            }`}
          >
            {/* Top Row: Batch ID & Status Tag */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${config.accentDot}`}
                  />
                  <span className="font-mono text-xs font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                    {batch.id}
                  </span>
                </div>

                <span
                  className={`font-mono text-[9px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${config.badgeBg}`}
                >
                  <StatusIcon className="w-2.5 h-2.5" />
                  {config.label}
                </span>
              </div>

              {/* Product Type & Zone */}
              <h4 className="font-sans text-sm font-semibold text-zinc-200 group-hover:text-white mb-1 leading-snug">
                {batch.productName}
              </h4>

              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 mb-3">
                <span className="text-zinc-500">{batch.line}</span>
                <span>•</span>
                <span
                  className={
                    batch.zone === "quarantine"
                      ? "text-rose-400 font-semibold"
                      : "text-zinc-400"
                  }
                >
                  {batch.zone === "quarantine" ? "Zona Karantina" : "Zona Standar"}
                </span>
              </div>
            </div>

            {/* Middle Section: Defect Count Badge */}
            <div className="pt-2.5 pb-2 border-t border-white/[0.06] mb-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] text-zinc-400 font-mono">
                  Defect Count:
                </span>
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    batch.defectCount === 0
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : batch.defectCount <= 5
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {batch.defectCount === 0
                    ? "0 Cacat (Bersih)"
                    : `${batch.defectCount} Cacat Terdeteksi`}
                </span>
              </div>

              {/* Mini defect chips if any */}
              {batch.defectTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {batch.defectTypes.map((dt, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-300"
                    >
                      {dt}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: Total Pcs, Time & Quick Expand Cue */}
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1">
              <span>{batch.totalPcs} Pcs</span>
              <div className="flex items-center gap-1 text-zinc-400 group-hover:text-emerald-400 transition-colors">
                <span>{batch.timeAgo}</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

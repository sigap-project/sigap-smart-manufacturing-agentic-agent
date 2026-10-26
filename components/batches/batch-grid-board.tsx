"use client";

import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  XCircle,
  Clock,
  Layers,
  ChevronRight,
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
          badgeBg: "bg-amber-50 text-amber-700 border-amber-200/80",
          label: "Pending Review",
          icon: Clock,
          accentDot: "bg-amber-500",
        };
      case "held":
      case "hold":
        return {
          badgeBg: "bg-rose-50 text-rose-700 border-rose-200/80",
          label: "Held (Quarantine)",
          icon: ShieldAlert,
          accentDot: "bg-rose-500",
        };
      case "released":
      case "approved":
        return {
          badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
          label: "Released",
          icon: CheckCircle2,
          accentDot: "bg-emerald-500",
        };
      case "rejected":
      case "scrap":
        return {
          badgeBg: "bg-slate-100 text-slate-700 border-slate-200/80",
          label: "Rejected",
          icon: XCircle,
          accentDot: "bg-slate-400",
        };
      default:
        return {
          badgeBg: "bg-amber-50 text-amber-700 border-amber-200/80",
          label: status || "Pending Review",
          icon: Clock,
          accentDot: "bg-amber-500",
        };
    }
  };

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
          <Layers className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h4 className="text-sm font-semibold text-slate-900 mb-1">
          No Matching Batches Found
        </h4>
        <p className="text-xs text-slate-500 max-w-sm">
          Adjust your manufacturing zone filters or search keyword to view other batch lots.
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
            className={`group relative rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:-translate-y-1 active:scale-[0.99] ${
              isSelected
                ? "border-slate-900 ring-2 ring-slate-900/10 bg-slate-50/50"
                : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/30"
            }`}
          >
            {/* Top Row: Batch ID & Status Tag */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.accentDot}`}
                  />
                  <span className="text-xs font-semibold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                    {batch.id}
                  </span>
                </div>

                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-xs ${config.badgeBg}`}
                >
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>

              {/* Product Type & Zone */}
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 mb-1 leading-snug">
                {batch.productName}
              </h4>

              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 font-medium">
                <span>{batch.line}</span>
                <span className="text-slate-300">•</span>
                <span
                  className={
                    batch.zone === "quarantine"
                      ? "text-rose-700 font-medium"
                      : "text-slate-500"
                  }
                >
                  {batch.zone === "quarantine" ? "Quarantine Zone" : "Standard Zone"}
                </span>
              </div>
            </div>

            {/* Middle Section: Defect Count Badge */}
            <div className="pt-3 pb-2.5 border-t border-slate-100 mb-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs text-slate-500 font-medium">
                  Defect Count:
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    batch.defectCount === 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                      : batch.defectCount <= 5
                      ? "bg-amber-50 text-amber-700 border-amber-200/80"
                      : "bg-rose-50 text-rose-700 border-rose-200/80"
                  }`}
                >
                  {batch.defectCount === 0
                    ? "0 Defects (Clean)"
                    : `${batch.defectCount} Defects Detected`}
                </span>
              </div>

              {/* Mini defect chips if any */}
              {batch.defectTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {batch.defectTypes.map((dt, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600"
                    >
                      {dt}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: Total Pcs, Time & Quick Expand Cue */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span className="font-medium text-slate-700 tabular-nums">{batch.totalPcs} Pcs</span>
              <div className="flex items-center gap-1 text-slate-500 group-hover:text-blue-600 transition-colors">
                <span>{batch.timeAgo}</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

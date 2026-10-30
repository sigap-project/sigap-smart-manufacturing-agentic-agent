"use client";

import {
  Check,
  Clock,
  ArrowRight,
} from "lucide-react";
import { BatchItem } from "./types";

interface BatchApprovalPanelProps {
  pendingBatches: BatchItem[];
  onInspectBatch: (batch: BatchItem) => void;
}

export function BatchApprovalPanel({
  pendingBatches,
  onInspectBatch,
}: BatchApprovalPanelProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-6 flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              Pending Human Review
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                {pendingBatches.length} in Queue
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Supervisor governance &amp; disposition queue (Human-in-the-Loop)
            </p>
          </div>
        </div>
      </div>

      {/* Stacked Approval List */}
      <div className="flex-1 space-y-3.5 overflow-y-auto pr-0.5">
        {pendingBatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-slate-50 border border-slate-200/80 text-center my-auto">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mb-2.5">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="text-xs font-semibold text-slate-800 mb-1">
              Queue Cleared
            </h4>
            <p className="text-xs text-slate-500">
              No batches currently require manual supervisor sign-off.
            </p>
          </div>
        ) : (
          pendingBatches.map((batch) => {
            return (
              <div
                key={batch.id}
                className="relative rounded-xl p-4 bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 transition-all duration-200 group flex flex-col justify-between gap-3 shadow-xs"
              >
                {/* Header: Batch ID, Part Name & SLA Timer */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {batch.id}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-medium text-slate-700 truncate max-w-[140px] sm:max-w-[180px]">
                        {batch.productName}
                      </span>
                    </div>

                    {/* Time since the lot was created (real, from Batch.createdAt) */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200/80">
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">{batch.timeAgo}</span>
                    </div>
                  </div>

                  {/* Defect Summary Line */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-2.5">
                    {batch.defectSummary || `${batch.defectCount} defect(s) recorded in this lot.`}
                  </p>

                  {/* Defect count */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium tabular-nums">
                        {batch.defectCount} defect(s) / {batch.inspectionCount ?? batch.totalPcs} inspected
                      </span>
                    </div>

                    <button
                      onClick={() => onInspectBatch(batch)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Decisions need a written reason and suspect review, so they happen in the drawer */}
                <button
                  onClick={() => onInspectBatch(batch)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all duration-200 cursor-pointer"
                  title="Review suspect inspections, then release or reject this lot"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Review &amp; Decide</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footnote Guide */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>SAP QM Dispatch: Automated on Hold</span>
        <span>Supervisor Line #02</span>
      </div>
    </div>
  );
}

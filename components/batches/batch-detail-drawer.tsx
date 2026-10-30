"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Layers,
  AlertTriangle,
  ExternalLink,
  Scan,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { BatchItem } from "./types";
import type { InspectionRecord } from "@/components/history/types";
import { useSigapGlobal, type MutationResult } from "@/context/sigap-global-context";

interface BatchDetailDrawerProps {
  batch: BatchItem | null;
  onClose: () => void;
  /** True only for a signed-in supervisor; the server enforces this too. */
  canDecide: boolean;
  csrfToken: string | null;
  onResult: (result: MutationResult) => void;
}

export function BatchDetailDrawer({
  batch,
  onClose,
  canDecide,
  csrfToken,
  onResult,
}: BatchDetailDrawerProps) {
  const { approveBatch, rejectBatch, reviewInspection } = useSigapGlobal();
  const [detail, setDetail] = useState<BatchItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const batchKey = batch ? batch.batchId || batch.id : null;

  // Fresh server copy: carries the current version and this lot's suspect inspections
  const loadDetail = useCallback(async () => {
    if (!batchKey) return;
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchKey)}`);
      const json = await res.json();
      if (json.success) setDetail(json.data);
    } catch {
      // Keep last known detail; actions still fail safely on a stale version
    }
  }, [batchKey]);

  useEffect(() => {
    setDetail(null);
    setReason("");
    loadDetail();
  }, [loadDetail]);

  if (!batch) return null;

  const current = detail || batch;
  const suspects: InspectionRecord[] = (detail?.inspections || []).filter(
    (i: InspectionRecord) => i.caseEpoch === detail?.caseEpoch
  );
  const unresolved = suspects.filter((i) => i.reviewOutcome !== "confirmed_ok").length;
  const canSubmit = canDecide && !busy && detail !== null && reason.trim().length > 0;

  const run = async (action: () => Promise<MutationResult>, closeOnSuccess: boolean) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    onResult(result);
    if (result.ok && closeOnSuccess) {
      onClose();
      return;
    }
    await loadDetail();
  };

  const decision = () => ({ version: detail?.version ?? 0, reason: reason.trim(), csrfToken });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative w-full max-w-md h-full bg-white border-l border-slate-200/80 shadow-2xl flex flex-col z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Batch Lot Details {batch.id}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {batch.productName}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
            {/* Status & Zone Banner */}
            <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 block mb-1">
                  Release Status
                </span>
                <span
                  className={`text-xs font-medium capitalize px-2.5 py-0.5 rounded-full border inline-block ${
                    batch.status === "released"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                      : batch.status === "held"
                      ? "bg-rose-50 text-rose-700 border-rose-200/80"
                      : batch.status === "pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200/80"
                      : "bg-slate-100 text-slate-700 border-slate-200/80"
                  }`}
                >
                  {batch.status}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs font-medium text-slate-500 block mb-1">
                  Manufacturing Zone
                </span>
                <span
                  className={`text-xs font-semibold ${
                    batch.zone === "quarantine"
                      ? "text-rose-700"
                      : "text-slate-700"
                  }`}
                >
                  {batch.zone === "quarantine" ? "Quarantine Zone" : "Standard Zone"}
                </span>
              </div>
            </div>

            {/* General Specs Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  Lot Quantity
                </span>
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                  {batch.totalPcs} Pcs
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  Detected Defects
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    batch.defectCount > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {batch.defectCount} Units
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  Material Supplier
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate block">
                  {batch.supplierName}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  Quality Inspector
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate block">
                  {batch.inspector}
                </span>
              </div>
            </div>

            {/* Escalation Score Breakdown */}
            {batch.escalationScore !== undefined && (
              <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Escalation Risk Score
                  </span>
                  <span className="text-xs font-semibold text-amber-700 tabular-nums">
                    {batch.escalationScore.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-500 ${
                      batch.escalationScore >= 0.7
                        ? "bg-rose-500"
                        : batch.escalationScore >= 0.4
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${Math.min(batch.escalationScore * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Formula: (Frequency × 0.40) + (Severity × 0.35) + (Supplier × 0.25)
                </p>
              </div>
            )}

            {/* Defect Summary Details */}
            {batch.defectSummary && (
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80">
                <span className="text-xs text-amber-800 font-semibold block mb-1">
                  AI Reasoning Summary
                </span>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {batch.defectSummary}
                </p>
              </div>
            )}

            {/* Suspect Inspections: must all be confirmed OK before release */}
            <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-800">Suspect Inspections (current case)</span>
                {detail === null ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      unresolved > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200/80"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                    }`}
                  >
                    {unresolved > 0 ? `${unresolved} need review` : "All cleared"}
                  </span>
                )}
              </div>

              {detail !== null && suspects.length === 0 && (
                <p className="text-xs text-slate-500">No defect or unknown inspections in this case.</p>
              )}

              <div className="space-y-2">
                {suspects.map((ins) => (
                  <div key={ins.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200/80">
                    {ins.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ins.imageUrl}
                        alt={`Inspection ${ins.itemId || ins.id}`}
                        className="w-12 h-12 rounded-md object-cover bg-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-slate-100 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{ins.itemId || ins.id}</p>
                      <p className="text-[11px] text-slate-500">
                        <span className="capitalize">{ins.outcome}</span>
                        {ins.confidence !== null && ` • ${ins.confidence}%`}
                        {ins.reviewOutcome && (
                          <span className={ins.reviewOutcome === "confirmed_ok" ? "text-emerald-700" : "text-rose-700"}>
                            {" "}• {ins.reviewOutcome.replace("_", " ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        disabled={!canSubmit || ins.reviewOutcome === "confirmed_ok"}
                        onClick={() => run(() => reviewInspection(ins.id, "confirmed_ok", decision()), false)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Confirm OK
                      </button>
                      <button
                        disabled={!canSubmit || ins.reviewOutcome === "confirmed_defect"}
                        onClick={() => run(() => reviewInspection(ins.id, "confirmed_defect", decision()), false)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Confirm Defect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Link to Inspection Station */}
            <div className="pt-1">
              <Link
                href="/dashboard/inspection"
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700 transition-all cursor-pointer group shadow-xs"
              >
                <Scan className="w-4 h-4 text-slate-600" />
                <span>Open in Optical Inspection Station</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Footer: Supervisor Decision (reason is recorded in the audit trail) */}
          <div className="p-4 border-t border-slate-100 bg-white space-y-2.5">
            {canDecide ? (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for this decision (required)"
                aria-label="Decision reason"
                rows={2}
                disabled={busy}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 resize-none select-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                Sign in as a supervisor to review inspections and release or reject this lot.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                disabled={!canSubmit}
                onClick={() => run(() => rejectBatch(current.id, decision()), true)}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 transition-colors cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Lot (Quarantine)</span>
              </button>
              <button
                disabled={!canSubmit || unresolved > 0}
                title={unresolved > 0 ? "Confirm every suspect inspection as OK first" : undefined}
                onClick={() => run(() => approveBatch(current.id, decision()), true)}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Approve Release</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

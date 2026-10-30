"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { InspectionRecord } from "./types";

interface HistoryDetailModalProps {
  record: InspectionRecord | null;
  onClose: () => void;
}

export function HistoryDetailModal({
  record,
  onClose,
}: HistoryDetailModalProps) {
  if (!record) return null;

  const isOk = record.defectClass === "OK" || record.defectClass === "ok";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative w-full max-w-2xl bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl border ${
                  isOk
                    ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
                    : "bg-amber-50 border-amber-200/80 text-amber-700"
                }`}
              >
                <Scan className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-base font-bold text-slate-900">
                    {record.id}
                  </h3>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      isOk
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        : "bg-amber-50 text-amber-700 border-amber-200/60"
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {record.partName} • {record.batchId} • {record.supplier}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close Dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* 1. Camera Snapshot Viewport Frame */}
            <div className="relative w-full h-52 sm:h-60 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
              {/* Corner Reticle Brackets */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-600" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-600" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-600" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-600" />

              {/* Center Target Indicator */}
              {isOk ? (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-2xl border-2 border-emerald-500/80 bg-emerald-500/10 flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                    PASSED OK [{record.confidence !== null ? record.confidence.toFixed(1) : "N/A"}%]
                  </span>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-2xl border-2 border-amber-400 bg-amber-500/15 flex items-center justify-center mb-2">
                    <AlertTriangle className="w-9 h-9 text-amber-400" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                    {record.defectClass.toUpperCase()} [{record.confidence !== null ? record.confidence.toFixed(1) : "N/A"}%]
                  </span>
                </div>
              )}

              {/* Telemetry Footer */}
              <div className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-400">
                {record.line} • OPTICAL SENSOR 01 • {record.timestamp}
              </div>
            </div>

            {/* 2. Full Agent Reasoning Trace */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-semibold text-slate-900">
                    Agent Reasoning Trace
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Model: YOLOv8-Nano + AWS Bedrock
                </span>
              </div>

              <div className="space-y-2">
                {record.reasoningSteps.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3"
                  >
                    <div className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] font-semibold text-slate-700 shrink-0">
                      {s.step}. {s.phase}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h5 className="text-xs font-semibold text-slate-900">
                          {s.title}
                        </h5>
                        {s.latency && (
                          <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {s.latency}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {s.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Link to Related Dispatch Record (If Exists) */}
            {record.dispatchId && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white text-slate-700 border border-slate-200 shadow-sm">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block font-mono">
                      Linked ERP Dispatch Ticket: {record.dispatchId}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      This incident has been synchronized to the enterprise SAP ERP gateway.
                    </span>
                  </div>
                </div>

                <Link
                  href="/dashboard/dispatch"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
                >
                  <span>View in Export Dispatch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

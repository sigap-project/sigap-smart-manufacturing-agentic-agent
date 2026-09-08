"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles,
  ExternalLink,
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

  const isOk = record.defectClass === "OK";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-[#090c12] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/[0.08] bg-[#06080d] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-2xl border ${
                  isOk
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                }`}
              >
                <Scan className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-base font-bold text-white">
                    {record.id}
                  </h3>
                  <span
                    className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      isOk
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
                <p className="font-sans text-xs text-zinc-400">
                  {record.partName} • {record.batchId} • {record.supplier}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* 1. Larger Image / High-Tech Camera Snapshot HUD */}
            <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden bg-[#06080d] border border-white/10 shadow-inner flex items-center justify-center">
              {/* Background Sensor Grid Texture */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem]" />

              {/* Viewport Corner Brackets */}
              <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-emerald-400/60" />
              <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-emerald-400/60" />
              <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-emerald-400/60" />
              <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-emerald-400/60" />

              {/* Center Simulated Part with Bounding Box Overlay */}
              {isOk ? (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-2xl border-2 border-emerald-400/70 bg-emerald-500/10 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)] mb-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                    PRODUK OK [{record.confidence.toFixed(1)}%]
                  </span>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-28 h-28 rounded-2xl border-2 border-amber-400 bg-amber-500/15 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.25)] mb-2 animate-pulse">
                    <AlertTriangle className="w-10 h-10 text-amber-400" />
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                    {record.defectClass} [{record.confidence.toFixed(1)}%]
                  </span>
                </div>
              )}

              {/* HUD Telemetry Watermark */}
              <div className="absolute bottom-3 left-4 text-[10px] font-mono text-zinc-500">
                {record.line} • SENSOR CAM-01 • {record.timestamp}
              </div>
            </div>

            {/* 2. Full Agent Reasoning Trace (Readable Step List) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Full Agent Reasoning Trace
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  Model: YOLOv8-Nano + AWS Bedrock
                </span>
              </div>

              <div className="space-y-2.5">
                {record.reasoningSteps.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 font-mono text-[10px] font-bold text-emerald-400 shrink-0">
                      [{s.step}. {s.phase}]
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h5 className="font-mono text-xs font-bold text-zinc-200">
                          {s.title}
                        </h5>
                        {s.latency && (
                          <span className="font-mono text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                            {s.latency}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                        {s.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Link to Related Dispatch Record (If Exists) */}
            {record.dispatchId && (
              <div className="p-4 rounded-2xl bg-cyan-500/[0.05] border border-cyan-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-white block">
                      Terkait dengan Tiket Dispatch ERP: {record.dispatchId}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-sans">
                      Data ini telah dieskalasi dan tercatat pada modul SAP ERP
                    </span>
                  </div>
                </div>

                <Link
                  href="/dashboard/dispatch"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-md shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Buka di Export Dispatch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#06080d] flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              Tutup Rincian
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

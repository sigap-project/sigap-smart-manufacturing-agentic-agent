"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Send,
  ExternalLink,
  Factory,
  Clock,
  Scan,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { BatchItem } from "./types";

interface BatchDetailDrawerProps {
  batch: BatchItem | null;
  onClose: () => void;
  onApprove: (batchId: string) => void;
  onReject: (batchId: string) => void;
}

export function BatchDetailDrawer({
  batch,
  onClose,
  onApprove,
  onReject,
}: BatchDetailDrawerProps) {
  if (!batch) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative w-full max-w-md h-full bg-[#090c12] border-l border-white/[0.1] shadow-2xl flex flex-col z-10 select-none overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#06080d]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <Layers className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-white block">
                  Detail Batch {batch.id}
                </span>
                <span className="font-sans text-[11px] text-zinc-400">
                  {batch.productName}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Tutup Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Status & Zone Banner */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                  Status Pelepasan
                </span>
                <span
                  className={`font-mono text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border inline-block ${
                    batch.status === "released"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : batch.status === "held"
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      : batch.status === "pending"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  {batch.status}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                  Lokasi Manufaktur
                </span>
                <span className="font-mono text-xs text-zinc-300 font-semibold">
                  {batch.zone === "quarantine" ? "Zona Karantina" : "Zona Standar"}
                </span>
              </div>
            </div>

            {/* General Specs Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                  Jumlah Lot
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {batch.totalPcs} Pcs
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                  Cacat Terdeteksi
                </span>
                <span
                  className={`text-sm font-bold font-mono ${
                    batch.defectCount > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {batch.defectCount} Unit
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                  Supplier Material
                </span>
                <span className="text-xs font-medium text-zinc-300 truncate block">
                  {batch.supplierName}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                  Inspector
                </span>
                <span className="text-xs font-medium text-zinc-300 truncate block">
                  {batch.inspector}
                </span>
              </div>
            </div>

            {/* Escalation Score Breakdown */}
            {batch.escalationScore !== undefined && (
              <div className="p-4 rounded-2xl bg-[#0e121a] border border-white/[0.08]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans text-xs font-semibold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Skor Formula Eskalasi
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {batch.escalationScore.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden mb-2">
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
                <p className="font-mono text-[10px] text-zinc-400">
                  Formula: (Frekuensi × 0.40) + (Severity × 0.35) + (Supplier × 0.25)
                </p>
              </div>
            )}

            {/* Defect Summary Details */}
            {batch.defectSummary && (
              <div className="p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20">
                <span className="text-[10px] uppercase font-mono text-amber-300 font-bold block mb-1">
                  Catatan Penalaran AI
                </span>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {batch.defectSummary}
                </p>
              </div>
            )}

            {/* Action Link to Inspection Station */}
            <div className="pt-2">
              <Link
                href="/dashboard/inspection"
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-mono font-medium text-white transition-all cursor-pointer group"
              >
                <Scan className="w-4 h-4 text-emerald-400" />
                <span>Buka di Stasiun Inspeksi Optik</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>

          {/* Footer Quick Actions */}
          <div className="p-4 border-t border-white/[0.08] bg-[#06080d] grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                onReject(batch.id);
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-mono font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Tolak / Tahan</span>
            </button>
            <button
              onClick={() => {
                onApprove(batch.id);
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/25 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Setujui Rilis</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

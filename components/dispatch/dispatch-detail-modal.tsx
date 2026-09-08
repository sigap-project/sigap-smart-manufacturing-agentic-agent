"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  FileText,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useState } from "react";
import { DispatchItem } from "./types";

interface DispatchDetailModalProps {
  dispatch: DispatchItem | null;
  onClose: () => void;
}

export function DispatchDetailModal({
  dispatch,
  onClose,
}: DispatchDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!dispatch) return null;

  const handleCopyTicket = () => {
    navigator.clipboard.writeText(dispatch.sapTicketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          className="relative w-full max-w-xl bg-[#090c12] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/[0.08] bg-[#06080d] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                <Send className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-base font-bold text-white">
                    {dispatch.id}
                  </h3>
                  <span
                    className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      dispatch.status === "Dispatched"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : dispatch.status === "Pending Approval"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {dispatch.status}
                  </span>
                </div>
                <p className="font-sans text-xs text-zinc-400">
                  Ringkasan Rincian Payload Integrasi ERP Manufaktur
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

          {/* Body: Plain Readable Labels (Human-Readable Format) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* 1. Context & Batch Info Card */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold block">
                Informasi Batch &amp; Komponen
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Batch ID:</span>
                  <span className="font-mono font-bold text-white">
                    {dispatch.batchId}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px]">Komponen:</span>
                  <span className="font-semibold text-zinc-200">
                    {dispatch.partName}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px]">Supplier Material:</span>
                  <span className="text-zinc-300 font-medium">
                    {dispatch.supplier}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px]">Skor Formula Eskalasi:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {dispatch.escalationScore.toFixed(2)} (Score)
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Alasan Trigger & Waktu Pengiriman */}
            <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-amber-300 font-bold block">
                Alasan Pemicu (Trigger Reason)
              </span>
              <p className="text-sm text-zinc-200 font-sans leading-relaxed">
                &ldquo;{dispatch.triggerReason}&rdquo;
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Waktu Dispatch: {dispatch.timestamp}</span>
              </div>
            </div>

            {/* 3. Who Approved It (Otorisasi & Persetujuan) */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold block">
                Otorisasi &amp; Persetujuan (Approved By)
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {dispatch.approvedBy}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Otorisasi Terverifikasi pada Audit Log Blockchain SIGAP
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Detail Eksekusi SAP ERP */}
            <div className="p-4 rounded-2xl bg-[#0b0e14] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold block">
                  Telemetri SAP ERP Integration
                </span>
                <span className="font-mono text-[10px] text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                  {dispatch.consumer}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/[0.06]">
                  <div>
                    <span className="text-[10px] text-zinc-500 block font-mono">
                      Tiket SAP / ID Referensi:
                    </span>
                    <span className="font-mono font-bold text-white text-xs">
                      {dispatch.sapTicketId}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyTicket}
                    className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Salin Nomor Tiket"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="p-2 rounded-xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 block font-mono">
                    Kode Defect Catalog:
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {dispatch.defectCode}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] text-zinc-400 font-sans leading-snug block">
                  <strong className="text-zinc-300">Tindakan ERP:</strong>{" "}
                  {dispatch.actionSummary}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#06080d] flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
              Protokol OData v4 • Enkripsi TLS 1.3
            </span>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer ml-auto"
            >
              Tutup Rincian
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

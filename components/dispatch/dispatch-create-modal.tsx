"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Send, CheckCircle2 } from "lucide-react";
import { ConsumerType, DispatchItem } from "./types";

interface DispatchCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (item: DispatchItem) => void;
}

export function DispatchCreateModal({
  isOpen,
  onClose,
  onCreate,
}: DispatchCreateModalProps) {
  const [consumer, setConsumer] = useState<ConsumerType>("SAP QM");
  const [batchId, setBatchId] = useState("#B-2026-0730");
  const [partName, setPartName] = useState("Bracket Motor A7");
  const [triggerReason, setTriggerReason] = useState("");
  const [supplier, setSupplier] = useState("PT Krakatau Scrap Ind.");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerReason.trim()) return;

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, "0")} Sep 2026, ${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} WIB`;

    const newItem: DispatchItem = {
      id: `DSP-2026-${Math.floor(420 + Math.random() * 80)}`,
      consumer,
      triggerReason: triggerReason.trim(),
      timestamp: formattedDate,
      rawDate: now.toISOString(),
      status: "Dispatched",
      batchId,
      partName,
      escalationScore: 0.76,
      approvedBy: "Budi Pratama (QC Supervisor)",
      sapTicketId: `${consumer.replace(" ", "-")}-${randomNum}`,
      defectCode: "DEF-MANUAL-01",
      defectClass: "Manual Supervisor Dispatch",
      actionSummary: `Tiket diterbitkan secara manual ke modul ${consumer}.`,
      supplier,
    };

    onCreate(newItem);
    onClose();
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

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-lg bg-[#090c12] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/[0.08] bg-[#06080d] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                <Plus className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Buat Tiket Dispatch Baru
                </h3>
                <p className="font-sans text-xs text-zinc-400">
                  Kirim instruksi eskalasi manual ke sistem ERP SAP atau Notifikasi
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {/* Consumer ERP Module */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                Target Consumer ERP
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["SAP QM", "SAP MM", "SAP PP", "Human Notification"] as ConsumerType[]).map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setConsumer(c)}
                      className={`p-2.5 rounded-xl text-xs font-mono font-medium border text-left transition-all cursor-pointer ${
                        consumer === c
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold"
                          : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Batch ID & Part Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                  Batch Lot ID
                </label>
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                  Nama Komponen
                </label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                Supplier Material
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Trigger Reason */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                Alasan Pemicu (Trigger Reason)
              </label>
              <textarea
                value={triggerReason}
                onChange={(e) => setTriggerReason(e.target.value)}
                placeholder="Contoh: Temuan cacat retak mikro pada 5 unit berurutan di Line #01..."
                rows={3}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Dispatch</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

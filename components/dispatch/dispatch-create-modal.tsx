"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Layers } from "lucide-react";
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
      escalationScore: 0,
      approvedBy: "Budi Pratama (QC Lead)",
      sapTicketId: `${consumer.replace(" ", "-")}-${randomNum}`,
      defectCode: "DEF-MANUAL-01",
      defectClass: "Manual Supervisor Dispatch",
      actionSummary: `Manual dispatch order routed to ${consumer} module.`,
      supplier,
    };

    onCreate(newItem);
    onClose();
  };

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

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <Layers className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Create New Dispatch Ticket
                </h3>
                <p className="text-xs text-slate-500">
                  Route manual escalation instructions to enterprise ERP modules or notification lists
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {/* Consumer ERP Module */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Target ERP Consumer
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["SAP QM", "SAP MM", "SAP PP", "Human Notification"] as ConsumerType[]).map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setConsumer(c)}
                      className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                        consumer === c
                          ? "bg-slate-900 border-slate-900 text-white font-semibold shadow-sm"
                          : "bg-slate-50/70 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Batch Lot ID
                </label>
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Component Name
                </label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Material Supplier
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            {/* Trigger Reason */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Trigger Reason
              </label>
              <textarea
                value={triggerReason}
                onChange={(e) => setTriggerReason(e.target.value)}
                placeholder="e.g. Micro-crack defect pattern identified across 5 consecutive parts on Line #01..."
                rows={3}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
              />
            </div>

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Dispatch</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

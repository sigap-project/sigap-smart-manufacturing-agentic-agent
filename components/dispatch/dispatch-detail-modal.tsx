"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Clock,
  UserCheck,
  Copy,
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
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-base font-bold text-slate-900">
                    {dispatch.id}
                  </h3>
                  <span
                    className={`font-sans text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                      dispatch.status === "Dispatched"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : dispatch.status === "Pending Approval"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {dispatch.status}
                  </span>
                </div>
                <p className="font-sans text-xs text-slate-500">
                  Manufacturing ERP Integration Payload Details
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* 1. Context & Batch Info Card */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block">
                Batch &amp; Component Context
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Batch ID:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {dispatch.batchId}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Component:</span>
                  <span className="font-semibold text-slate-800">
                    {dispatch.partName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Material Supplier:</span>
                  <span className="text-slate-700 font-medium">
                    {dispatch.supplier}
                  </span>
                </div>

              </div>
            </div>

            {/* 2. Trigger Reason */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-amber-800 font-bold block">
                Trigger Reason
              </span>
              <p className="text-xs text-slate-800 font-sans leading-relaxed">
                &ldquo;{dispatch.triggerReason}&rdquo;
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-[11px] font-mono text-slate-500">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Timestamp: {dispatch.timestamp}</span>
              </div>
            </div>

            {/* 3. Authorization & Sign-off */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block">
                Authorization &amp; Sign-off
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {dispatch.approvedBy}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Verified on SIGAP Manufacturing Audit Trail
                  </span>
                </div>
              </div>
            </div>

            {/* 4. SAP Telemetry Detail */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block">
                  SAP ERP Integration Telemetry
                </span>
                <span className="font-mono text-[10px] text-blue-700 font-semibold px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                  {dispatch.consumer}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      SAP Reference / Ticket:
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {dispatch.sapTicketId}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyTicket}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Copy Ticket ID"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Defect Catalog Code:
                  </span>
                  <span className="font-mono font-bold text-blue-600 text-xs">
                    {dispatch.defectCode}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11.5px] text-slate-600 font-sans leading-snug block">
                  <strong className="text-slate-900">ERP Action:</strong>{" "}
                  {dispatch.actionSummary}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              OData v4 Protocol • TLS 1.3 Encryption
            </span>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer ml-auto shadow-sm"
            >
              Close Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

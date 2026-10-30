"use client";

import { motion } from "framer-motion";
import {
  Send,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { DispatchItem } from "./types";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface DispatchStatCardsProps {
  dispatches: DispatchItem[];
}

export function DispatchStatCards({ dispatches }: DispatchStatCardsProps) {
  const total = dispatches.length;
  const qmCount = dispatches.filter((d) => d.consumer === "SAP QM").length;
  const mmppCount = dispatches.filter(
    (d) => d.consumer === "SAP MM" || d.consumer === "SAP PP"
  ).length;
  const pending = dispatches.filter((d) => d.status === "Pending Approval").length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Dispatches */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-1"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Total Dispatches
            </span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900 mb-1 tabular-nums">
            <AnimatedCounter value={total} duration={1.0} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 pt-2 border-t border-slate-100">
          <span>All recorded ERP actions</span>
        </div>
      </motion.div>

      {/* 2. SAP QM Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-1"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              SAP QM Notifications
            </span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900 mb-1 tabular-nums">
            <AnimatedCounter value={qmCount} duration={1.0} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 pt-2 border-t border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Quality hold &amp; defects</span>
        </div>
      </motion.div>

      {/* 3. SAP MM & PP Sync */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.29, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-1"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              SAP MM &amp; PP Sync
            </span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900 mb-1 tabular-nums">
            <AnimatedCounter value={mmppCount} duration={1.0} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 pt-2 border-t border-slate-100">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Materials &amp; routing sync</span>
        </div>
      </motion.div>

      {/* 4. Pending Approval */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-1"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Pending Approval
            </span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="text-3xl font-bold tracking-tight text-amber-600 mb-1 tabular-nums">
            <AnimatedCounter value={pending} duration={1.0} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 pt-2 border-t border-slate-100">
          <Clock className="w-3.5 h-3.5" />
          <span>Awaiting supervisor review</span>
        </div>
      </motion.div>
    </div>
  );
}

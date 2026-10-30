"use client";

import { motion } from "framer-motion";
import {
  Layers,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { BatchItem } from "./types";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface BatchStatCardsProps {
  batches: BatchItem[];
}

export function BatchStatCards({ batches }: BatchStatCardsProps) {
  const total = batches.length;
  const pending = batches.filter((b) => b.status === "pending" || (b.status as string) === "pending_review").length;
  const held = batches.filter((b) => b.status === "held" || (b.status as string) === "hold").length;
  const released = batches.filter((b) => b.status === "released" || (b.status as string) === "approved").length;
  const rejected = batches.filter((b) => b.status === "rejected" || (b.status as string) === "scrap").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4 mb-6">
      {/* 1. Total Batches */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-slate-300 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Total Batches
            </span>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={total} duration={1.0} />
            </h3>
            <span className="text-xs text-slate-400 font-medium">Lots</span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            All recorded lots
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            From batch records
          </span>
        </div>
      </motion.div>

      {/* 2. Pending Review */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-slate-300 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Pending Review
            </span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={pending} duration={1.0} />
            </h3>
            <span className="text-xs text-slate-400 font-medium">Batches</span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Awaiting supervisor sign-off
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-amber-700 font-medium text-[11px]">
            Active SLA
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
            Review
          </span>
        </div>
      </motion.div>

      {/* 3. Held (Quarantine) */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.29, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-slate-300 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Held (Quarantine)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={held} duration={1.0} />
            </h3>
            <span className="text-xs text-slate-400 font-medium">Batches</span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Isolated in Quarantine Zone
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-rose-700 font-medium text-[11px]">
            Physical Lock
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 font-medium">
            Quarantine
          </span>
        </div>
      </motion.div>

      {/* 4. Released */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-slate-300 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Released
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={released} duration={1.0} />
            </h3>
            <span className="text-xs text-slate-400 font-medium">Batches</span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Approved for assembly
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-emerald-700 font-medium text-[11px]">
            QC Passed
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium">
            Passed
          </span>
        </div>
      </motion.div>

      {/* 5. Rejected */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.43, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-slate-300 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group col-span-2 sm:col-span-1 xl:col-span-1"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">
              Rejected
            </span>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={rejected} duration={1.0} />
            </h3>
            <span className="text-xs text-slate-400 font-medium">Batches</span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Scrapped due to defects
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium text-[11px]">
            Scrap Disposition
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
            Scrap
          </span>
        </div>
      </motion.div>
    </div>
  );
}

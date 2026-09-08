"use client";

import {
  Send,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { DispatchItem } from "./types";

interface DispatchStatCardsProps {
  dispatches: DispatchItem[];
}

export function DispatchStatCards({ dispatches }: DispatchStatCardsProps) {
  const total = dispatches.length;
  const pending = dispatches.filter((d) => d.status === "Pending Approval").length;
  const dispatched = dispatches.filter((d) => d.status === "Dispatched").length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6">
      {/* 1. Total Dispatches (Hero Green Accent) */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 border border-emerald-400/40 shadow-xl shadow-emerald-950/40 text-white overflow-hidden flex flex-col justify-between group hover:shadow-emerald-500/25 transition-all duration-300">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Total Dispatches
            </span>
            <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/20">
              <Send className="w-3.5 h-3.5 text-emerald-200" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {total}
            </h3>
            <span className="font-mono text-sm text-emerald-100 font-medium">
              Tiket ERP
            </span>
          </div>
          <p className="text-[11px] text-emerald-100/80 font-mono">
            SAP QM • SAP MM • SAP PP • Human
          </p>
        </div>

        <div className="relative z-10 pt-4 mt-2 border-t border-white/15 flex items-center justify-between text-[11px] font-mono text-emerald-200">
          <span className="flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            +18.2% vs Kemarin
          </span>
          <span className="text-emerald-100/70 text-[10px]">Hari Ini</span>
        </div>
      </div>

      {/* 2. Pending (Amber Accent) */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-amber-500/30 hover:border-amber-400/50 shadow-lg shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Pending Approval
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-amber-400">
              {pending}
            </h3>
            <span className="font-mono text-sm text-zinc-400">
              Menunggu Review
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Perlu konfirmasi supervisor sebelum sync
          </p>
        </div>

        <div className="pt-4 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="font-mono text-amber-400 font-medium">
            Human-in-the-Loop
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
            QUEUE ACTIVE
          </span>
        </div>
      </div>

      {/* 3. Dispatched (Cyan/Emerald Accent) */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] hover:border-cyan-500/40 shadow-lg shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Dispatched (Terkirim)
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-cyan-400">
              {dispatched}
            </h3>
            <span className="font-mono text-sm text-zinc-400">
              Sinkronisasi Sukses
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Terkirim via SAP OData Connector v4
          </p>
        </div>

        <div className="pt-4 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="font-mono text-cyan-300 font-medium">
            100% Delivery Rate
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
            ODATA V4
          </span>
        </div>
      </div>
    </div>
  );
}

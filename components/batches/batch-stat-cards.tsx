"use client";

import {
  Layers,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { BatchItem } from "./types";

interface BatchStatCardsProps {
  batches: BatchItem[];
}

export function BatchStatCards({ batches }: BatchStatCardsProps) {
  const total = batches.length;
  const pending = batches.filter((b) => b.status === "pending").length;
  const held = batches.filter((b) => b.status === "held").length;
  const released = batches.filter((b) => b.status === "released").length;
  const rejected = batches.filter((b) => b.status === "rejected").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4 mb-6">
      {/* 1. Total Batches (Hero Green Accent) */}
      <div className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 border border-emerald-400/40 shadow-lg shadow-emerald-950/40 text-white overflow-hidden flex flex-col justify-between group hover:shadow-emerald-500/25 transition-all duration-300">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-emerald-100">
              Total Batches
            </span>
            <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/20">
              <Layers className="w-3.5 h-3.5 text-emerald-200" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {total}
            </h3>
            <span className="font-mono text-xs text-emerald-100">Lot</span>
          </div>
          <p className="text-[10px] text-emerald-100/80 font-mono truncate">
            Shift #1 • 3 Line Konveyor
          </p>
        </div>

        <div className="relative z-10 pt-3 mt-2 border-t border-white/15 flex items-center justify-between text-[10px] font-mono text-emerald-200">
          <span className="flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3 h-3" />
            100% Tercatat
          </span>
          <span className="text-emerald-100/70">Hari Ini</span>
        </div>
      </div>

      {/* 2. Pending Review (Amber Accent) */}
      <div className="relative rounded-2xl p-4 sm:p-5 bg-[#0b0e14]/80 backdrop-blur-md border border-amber-500/30 hover:border-amber-400/50 shadow-md shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Pending Review
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-amber-400">
              {pending}
            </h3>
            <span className="font-mono text-xs text-zinc-400">Batch</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            Menunggu keputusan supervisor
          </p>
        </div>

        <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
          <span className="font-mono text-amber-400 font-medium">
            SLA Aktif
          </span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
            REVIEW
          </span>
        </div>
      </div>

      {/* 3. Held / Karantina (Red / Rose Accent) */}
      <div className="relative rounded-2xl p-4 sm:p-5 bg-[#0b0e14]/80 backdrop-blur-md border border-rose-500/30 hover:border-rose-400/50 shadow-md shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Held
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-rose-400">
              {held}
            </h3>
            <span className="font-mono text-xs text-zinc-400">Batch</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            Diisolasi di Zona Karantina
          </p>
        </div>

        <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
          <span className="font-mono text-rose-400 font-medium">
            Lock Fisik
          </span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold">
            QUARANTINE
          </span>
        </div>
      </div>

      {/* 4. Released (Emerald Accent) */}
      <div className="relative rounded-2xl p-4 sm:p-5 bg-[#0b0e14]/80 backdrop-blur-md border border-emerald-500/30 hover:border-emerald-400/50 shadow-md shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Released
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">
              {released}
            </h3>
            <span className="font-mono text-xs text-zinc-400">Batch</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            Disetujui untuk perakitan/kirim
          </p>
        </div>

        <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
          <span className="font-mono text-emerald-400 font-medium">
            Lolos QC
          </span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
            PASSED
          </span>
        </div>
      </div>

      {/* 5. Rejected (Muted Gray Accent) */}
      <div className="relative rounded-2xl p-4 sm:p-5 bg-[#0b0e14]/80 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 shadow-md shadow-black/40 flex flex-col justify-between transition-all duration-300 group col-span-2 sm:col-span-1 xl:col-span-1">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
                <XCircle className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Rejected
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          </div>

          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-300">
              {rejected}
            </h3>
            <span className="font-mono text-xs text-zinc-500">Batch</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            Ditolak karena cacat fatal
          </p>
        </div>

        <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
          <span className="font-mono text-zinc-400 font-medium">
            Disposisi Scrap
          </span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
            SCRAP
          </span>
        </div>
      </div>
    </div>
  );
}

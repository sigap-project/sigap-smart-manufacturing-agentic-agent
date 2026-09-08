"use client";

import {
  CalendarDays,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  PackageCheck,
  Send,
  AlertTriangle,
} from "lucide-react";

interface DashboardStatCardsProps {
  totalInspections?: number;
  activeLotId?: string;
  defectRate?: number;
  batchesHeldCount?: number;
  heldDefectPcs?: number;
  dispatchesCount?: number;
}

export function DashboardStatCards({
  totalInspections = 1428,
  activeLotId = "#B-2026-0730",
  defectRate = 1.84,
  batchesHeldCount = 3,
  heldDefectPcs = 45,
  dispatchesCount = 18,
}: DashboardStatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mb-6">
      {/* 1. Hero Accent Card: Inspeksi Hari Ini (Matching reference's high-visibility 'Todays Data' card) */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 border border-emerald-400/40 shadow-xl shadow-emerald-950/40 text-white overflow-hidden flex flex-col justify-between group hover:shadow-emerald-500/25 transition-all duration-300">
        {/* Subtle decorative mesh glow */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 opacity-10 pointer-events-none">
          <CalendarDays className="w-28 h-28 -mr-4 -mb-4 stroke-[1]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Inspeksi Hari Ini
            </span>
            <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/20">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-200" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {totalInspections.toLocaleString("id-ID")}
            </h3>
            <span className="font-mono text-sm text-emerald-100 font-medium">
              Pcs
            </span>
          </div>
          <p className="text-[11px] text-emerald-100/80 font-mono">
            Lot Aktif: {activeLotId}
          </p>
        </div>

        <div className="relative z-10 pt-4 mt-2 border-t border-white/15 flex items-center justify-between text-[11px]">
          <span className="font-mono text-emerald-200 flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            +12.4% vs Kemarin
          </span>
          <span className="text-emerald-100/70 text-[10px]">
            Baru saja
          </span>
        </div>
      </div>

      {/* 2. Defect Rate */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] hover:border-emerald-500/30 shadow-lg shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Defect Rate
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-emerald-400">
              {defectRate.toFixed(2)}%
            </h3>
            <span className="font-mono text-xs text-zinc-400">
              Avg
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Toleransi Pabrik: &lt; 2.50%
          </p>
        </div>

        <div className="pt-4 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="font-mono text-emerald-400 font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            -0.42% Membaik
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
            STATUS OK
          </span>
        </div>
      </div>

      {/* 3. Batch Ditahan (Quarantine) */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] hover:border-amber-500/30 shadow-lg shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Batch Ditahan
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-amber-400">
              {batchesHeldCount}
            </h3>
            <span className="font-mono text-sm text-zinc-400">
              Lot Karantina
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Total {heldDefectPcs} pcs anomali terdeteksi
          </p>
        </div>

        <div className="pt-4 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="font-mono text-amber-400 font-medium">
            Review Agent Bedrock
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
            HOLD AREA
          </span>
        </div>
      </div>

      {/* 4. Dispatch Terkirim (SAP ERP) */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] hover:border-cyan-500/30 shadow-lg shadow-black/40 flex flex-col justify-between transition-all duration-300 group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25">
                <Send className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Dispatch Terkirim
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-cyan-400">
              {dispatchesCount}
            </h3>
            <span className="font-mono text-sm text-zinc-400">
              Aksi Otonom
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Sinkronisasi Gateway Aktif
          </p>
        </div>

        <div className="pt-4 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="font-mono text-cyan-300 font-medium">
            100% Sinkronisasi Sukses
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
            ODATA V4
          </span>
        </div>
      </div>
    </div>
  );
}

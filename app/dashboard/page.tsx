import { Metadata } from "next";
import { sigapStore } from "@/lib/store";
import { DashboardStatCards } from "@/components/dashboard/dashboard-stat-cards";
import { DashboardTrendChart } from "@/components/dashboard/dashboard-trend-chart";
import { DashboardDefectDistribution } from "@/components/dashboard/dashboard-defect-distribution";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";
import { DashboardPriorityItems } from "@/components/dashboard/dashboard-priority-items";

export const metadata: Metadata = {
  title: "Dashboard Operasional QC — SIGAP Agentic AI",
  description:
    "Pusat Pemantauan Cacat Komponen Logam, Penalaran Agentic AI AWS Bedrock, dan Mutasi Otonom SAP QM/MM/PP.",
};

export default async function DashboardPage() {
  const stats = await sigapStore.getDashboardStats();

  const totalInspections = stats.totalInspections;
  const activeLotId = stats.activeLotId;
  const defectRate = stats.defectRate;
  const batchesHeldCount = stats.batchesHeldCount;
  const heldDefectPcs = stats.heldDefectPcs;
  const dispatchesCount = stats.dispatchesCount;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title & Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Pusat Operasional Kualitas
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              LIVE TELEMETRY
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            Pemantauan deteksi YOLOv8, penalaran otonom AWS Bedrock, dan eksekusi mutasi ERP bisnis SAP.
          </p>
        </div>

        {/* Quick Shift Status Tag */}
        <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Lini Aktif: HPDC #02</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Target OEE:</span>
            <span className="text-emerald-400 font-bold">89.4%</span>
          </div>
        </div>
      </div>

      {/* Row 1: 4 Top Stat Cards dengan Real Metrics dari PostgreSQL */}
      <DashboardStatCards
        totalInspections={totalInspections}
        activeLotId={activeLotId}
        defectRate={defectRate}
        batchesHeldCount={batchesHeldCount}
        heldDefectPcs={heldDefectPcs}
        dispatchesCount={dispatchesCount}
      />

      {/* Row 2: Main Hourly Trend Chart (8 cols) + Defect Distribution Donut (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <DashboardTrendChart />
        </div>
        <div className="lg:col-span-4">
          <DashboardDefectDistribution
            disposition={stats.defectDisposition}
            totalDefects={stats.totalDefects}
          />
        </div>
      </div>

      {/* Row 3: Recent Agent Decisions Feed (6 cols) + Priority Items Attention List (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <DashboardRecentActivity />
        </div>
        <div className="lg:col-span-6">
          <DashboardPriorityItems />
        </div>
      </div>
    </div>
  );
}
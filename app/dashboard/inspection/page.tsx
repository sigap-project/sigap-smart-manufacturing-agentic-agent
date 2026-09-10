import { Metadata } from "next";
import { sigapStore } from "@/lib/store";
import { InspectionCameraPanel } from "@/components/inspection/inspection-camera-panel";
import { InspectionEventsList } from "@/components/inspection/inspection-events-list";
import { InspectionAgentTrace } from "@/components/inspection/inspection-agent-trace";
import { InspectionEscalationGauge } from "@/components/inspection/inspection-escalation-gauge";

export const metadata: Metadata = {
  title: "Inspeksi Optik & Penalaran AI — SIGAP Agentic AI",
  description:
    "Streaming Langsung Kamera Optik Konveyor, Deteksi Bounding Box YOLOv8, dan Log Penalaran Otonom AWS Bedrock.",
};

export default async function InspectionPage() {
  let activeLot = "#B-2026-0730";
  let activePart = "Bracket Motor A7";
  let escalationScore = 0.74;
  let liveEvents: any[] | undefined = undefined;
  let liveTraces: any[] | undefined = undefined;

  try {
    const [batchesResult, inspectionsResult] = await Promise.all([
      sigapStore.getBatches({ limit: 1 }),
      sigapStore.getInspections({ limit: 6 }),
    ]);

    const batch = batchesResult.data[0];
    const inspections = inspectionsResult.data;

    if (batch) {
      activeLot = batch.lotId || activeLot;
      activePart = batch.productType || batch.productName || activePart;
      escalationScore = batch.escalationScore ?? 0.74;
    }

    if (inspections && inspections.length > 0) {
      liveEvents = inspections.map((ins, idx) => {
        const isDefect = ins.defectClass?.toLowerCase() !== "ok";
        return {
          id: `EV-${idx}-${ins.id.slice(-4)}`,
          label: isDefect ? "defect" : "ok",
          status: isDefect ? "DEFECT" : "PASSED",
          confidence: Number(ins.confidence.toFixed(1)),
          time: `${((idx + 1) * 1.2).toFixed(1)}s lalu`,
          lot: (() => {
            const raw = String(ins.batchId || activeLot).trim();
            const cleaned = raw.replace(/^batch-/i, "");
            return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
          })(),
          part: ins.partName ? ins.partName.replace("Bracket Motor ", "Bracket ") : "Bracket A7",
          isDefect,
          badgeColor: isDefect
            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          barColor: isDefect ? "bg-rose-400" : "bg-emerald-400",
          thumbCode: isDefect ? "DEF" : "OK",
          thumbBg: isDefect
            ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
            : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
        };
      });

      if (inspections[0]?.reasoningSteps && inspections[0].reasoningSteps.length > 0) {
        liveTraces = inspections[0].reasoningSteps.map((t) => ({
          step: `${t.step}. ${t.phase}`,
          timestamp: "14:32:01.180",
          tag:
            t.phase === "DETECT"
              ? "YOLOv8-Nano"
              : t.phase === "MEMORY"
              ? "Bedrock-Memory"
              : t.phase === "FORMULA"
              ? "Formula-Engine"
              : t.phase === "DECISION"
              ? "Autonomous-Agent"
              : "SAP-Integration",
          tagColor:
            t.phase === "DETECT"
              ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
              : t.phase === "MEMORY"
              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
              : t.phase === "DECISION"
              ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          content: t.detail,
          metric: t.latency ? `Latensi: ${t.latency}` : "Confidence Verified",
        }));
      }
    }
  } catch (err) {
    console.warn("Koneksi DB untuk Stasiun Inspeksi offline, menggunakan nilai default:", err);
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Stasiun Inspeksi &amp; Penalaran AI
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VISION AGENT ONLINE
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            Streaming optik konveyor Station #01, deteksi bounding box YOLOv8-Nano, dan penalaran eskalasi otonom AWS Bedrock.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Lot:</span>
            <span className="text-white font-bold">{activeLot}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Komponen:</span>
            <span className="text-emerald-400 font-bold">{activePart}</span>
          </div>
        </div>
      </div>

      {/* Two-Column Split Layout (60% Left, 40% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (60%): Live Camera & File Upload Panel with Bounding Boxes & HUD Controls */}
        <div className="lg:col-span-7 xl:col-span-7">
          <InspectionCameraPanel lotId={activeLot} productType={activePart} />
        </div>

        {/* RIGHT COLUMN (40%): Stacked Recent Events, Agent Reasoning Trace, and Escalation Gauge */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6">
          {/* Top Panel: Kejadian Terbaru dengan Live PostgreSQL Events */}
          <InspectionEventsList events={liveEvents} />

          {/* Bottom Panel: Agent Reasoning Trace dengan Live Traces */}
          <InspectionAgentTrace traces={liveTraces} />

          {/* Below Both Panels: Escalation Score Gauge dengan Real Batch Score */}
          <InspectionEscalationGauge
            score={escalationScore}
            lotId={`Lot ${activeLot}`}
            partName={activePart}
          />
        </div>
      </div>
    </div>
  );
}

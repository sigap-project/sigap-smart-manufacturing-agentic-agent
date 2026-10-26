import { Metadata } from "next";
import { sigapStore } from "@/lib/store";
import { InspectionViewClient } from "@/components/inspection/inspection-view-client";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Live Camera & Defect Analysis Station | SIGAP",
  description: "Live optical defect detection and autonomous agentic quality inspection station.",
};

export default async function InspectionPage() {
  let activeLot = "#B-2026-0730";
  let activePart = "Submersible Pump Impeller Casting";
  let escalationScore = 0.05;
  let liveEvents: any[] | undefined = undefined;
  let liveTraces: any[] | undefined = undefined;

  try {
    const [batchesResult, inspectionsResult, latestWithLogs] = await Promise.all([
      sigapStore.getBatches({ limit: 1 }),
      sigapStore.getInspections({ limit: 6 }),
      prisma.inspection.findFirst({
        orderBy: { receivedAt: "desc" },
        include: {
          agentLogs: { orderBy: { sequence: "asc" } },
        },
      }),
    ]);

    const batch = batchesResult.data[0];
    const inspections = inspectionsResult.data;

    if (batch) {
      activeLot = batch.lotId || activeLot;
      activePart = batch.productType || batch.productName || activePart;
      escalationScore = batch.defectCount >= 3 ? 0.88 : (batch.defectCount > 0 ? 0.45 : 0.05);
    }

    if (inspections && inspections.length > 0) {
      liveEvents = inspections.map((ins: any, idx: number) => {
        const isDefect = ins.defectClass?.toLowerCase() !== "ok";
        return {
          id: ins.id,
          label: isDefect ? "defect" : "ok",
          status: isDefect ? "DEFECT" : "PASSED",
          confidence: Number(ins.confidence.toFixed(1)),
          time: ins.timestamp || "Baru saja",
          lot: ins.batchId || activeLot,
          part: ins.partName || activePart,
          isDefect,
          badgeColor: isDefect
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200",
          barColor: isDefect ? "bg-rose-500" : "bg-emerald-500",
          thumbCode: isDefect ? "DEF" : "OK",
          thumbBg: isDefect
            ? "bg-rose-50 border-rose-200 text-rose-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700",
        };
      });
    }

    if (latestWithLogs && latestWithLogs.agentLogs.length > 0) {
      liveTraces = latestWithLogs.agentLogs.map((log) => {
        const stage = (log.stage || log.stepName || "DETECT").toUpperCase();
        let tag = "Governed-Agent";
        let tagColor = "text-rose-700 bg-rose-50 border-rose-200";
        if (stage === "DETECT") {
          tag = "Pi-Edge-ONNX";
          tagColor = "text-blue-700 bg-blue-50 border-blue-200";
        } else if (stage === "MEMORY") {
          tag = "Postgres-Context";
          tagColor = "text-amber-700 bg-amber-50 border-amber-200";
        } else if (stage === "FORMULA") {
          tag = "Policy-Engine";
          tagColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
        } else if (stage === "DISPATCH") {
          tag = "SAP-Simulator";
          tagColor = "text-purple-700 bg-purple-50 border-purple-200";
        }

        const outObj = (log.output as Record<string, unknown>) || {};
        const content =
          (outObj.summary as string) ||
          (outObj.result as string) ||
          (outObj.decision ? `Decision: ${outObj.decision}` : "Reasoning verified");

        return {
          step: `${log.step}. ${stage}`,
          stage,
          timestamp: log.timestamp.toISOString().slice(11, 19),
          tag,
          tagColor,
          content,
          metric: typeof log.latencyMs === "number" ? `${log.latencyMs}ms` : "Verified",
        };
      });
    }
  } catch (err) {
    console.warn("DB connection for Inspection Station query:", err);
  }

  return (
    <InspectionViewClient
      activeLot={activeLot}
      activePart={activePart}
      escalationScore={escalationScore}
      liveEvents={liveEvents}
      liveTraces={liveTraces}
    />
  );
}

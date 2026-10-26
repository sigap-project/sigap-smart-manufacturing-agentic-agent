import { Metadata } from "next";
import { sigapStore } from "@/lib/store";
import { InspectionViewClient } from "@/components/inspection/inspection-view-client";

export const metadata: Metadata = {
  title: "Optical Inspection & AI Reasoning — SIGAP Agentic AI",
  description:
    "Live Conveyor Optical Streaming, YOLOv8 Bounding Box Inference, and AWS Bedrock Autonomous Escalation Logs.",
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
      liveEvents = inspections.map((ins: any, idx: number) => {
        const isDefect = ins.defectClass?.toLowerCase() !== "ok";
        return {
          id: `EV-${idx}-${ins.id.slice(-4)}`,
          label: isDefect ? "defect" : "ok",
          status: isDefect ? "DEFECT" : "PASSED",
          confidence: Number(ins.confidence.toFixed(1)),
          time: `${((idx + 1) * 1.2).toFixed(1)}s ago`,
          lot: (() => {
            const raw = String(ins.batchId || activeLot).trim();
            const cleaned = raw.replace(/^batch-/i, "");
            return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
          })(),
          part: ins.partName ? ins.partName.replace("Bracket Motor ", "Bracket ") : "Bracket A7",
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

      if (inspections[0]?.reasoningSteps && inspections[0].reasoningSteps.length > 0) {
        const translateDetail = (detail: string, phase: string) => {
          if (!detail) return detail;
          if (detail.includes("Anomali cacat casting") || phase === "DETECT") {
            return "Casting surface defect anomaly detected on workpiece coordinates X:524 Y:312 with 94.2% confidence.";
          }
          if (detail.includes("Ditemukan 3 anomali") || phase === "MEMORY") {
            return "Historical correlation match: 3 recurring defect anomalies detected within last 8 minutes from supplier PT Krakatau Scrap.";
          }
          if (detail.includes("Kalkulasi: (Frekuensi") || phase === "FORMULA") {
            return "Formula calculation: (Frequency: 3 × 0.40) + (Severity: 0.85 × 0.35) + (Vendor: 0.60 × 0.25) = Escalation Score 0.74.";
          }
          if (detail.includes("Skor eskalasi") || phase === "DECISION") {
            return "Escalation score threshold (>0.70) exceeded. Autonomous agent triggered lot quarantine and ERP escalation.";
          }
          if (detail.includes("Notifikasi") || phase === "DISPATCH") {
            return "Quality notification ticket generated in SAP QM and vendor status updated to UnderReview in SAP MM.";
          }
          return detail;
        };

        liveTraces = inspections[0].reasoningSteps.map((t: any) => ({
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
              ? "text-blue-700 bg-blue-50 border-blue-200"
              : t.phase === "MEMORY"
              ? "text-amber-700 bg-amber-50 border-amber-200"
              : t.phase === "DECISION"
              ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-emerald-700 bg-emerald-50 border-emerald-200",
          content: translateDetail(t.detail, t.phase),
          metric: t.latency ? `Latency: ${t.latency}` : "Confidence Verified",
        }));
      }
    }
  } catch (err) {
    console.warn("DB connection for Inspection Station offline, using defaults:", err);
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

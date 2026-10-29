import { Metadata } from "next";
import { sigapStore } from "@/lib/store";
import { InspectionViewClient } from "@/components/inspection/inspection-view-client";

export const metadata: Metadata = {
  title: "Image & Webcam Inspection | SIGAP",
  description:
    "Single-image upload and local webcam defect analysis station for submersible pump impeller castings.",
};

export default async function InspectionPage() {
  let initialBatchId: string | null = null;
  let activeLot: string | null = null;
  let activePart: string | null = null;
  let escalationScore: number | null = null;

  try {
    const batchesResult = await sigapStore.getBatches({ limit: 1 });
    const batch = batchesResult.data[0];

    if (batch) {
      initialBatchId = batch.batchId || batch.id;
      activeLot = batch.lotId || null;
      activePart = batch.productType || batch.productName || null;
      escalationScore = typeof batch.escalationScore === "number" ? batch.escalationScore : null;
    }
  } catch (err) {
    console.warn("DB query for Initial Batch in Inspection Station:", err);
  }

  return (
    <InspectionViewClient
      initialBatchId={initialBatchId}
      activeLot={activeLot}
      activePart={activePart}
      escalationScore={escalationScore}
    />
  );
}

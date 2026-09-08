import { prisma } from "@/lib/prisma";
import {
  ConsumerType,
  DispatchItem,
  DispatchStatus,
} from "@/components/dispatch/types";

// Helper untuk memformat rekaman Prisma DispatchRecord ke interface DispatchItem
export function formatDispatchRecord(item: any): DispatchItem {
  const dateObj = item.dispatchedAt ? new Date(item.dispatchedAt) : new Date();
  const formattedDate =
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(dateObj) + " WIB";

  const payload =
    typeof item.payload === "object" && item.payload !== null
      ? item.payload
      : {};

  return {
    id: item.id,
    consumer: item.consumer as ConsumerType,
    triggerReason: item.triggerReason,
    timestamp: formattedDate,
    rawDate: dateObj.toISOString(),
    status: (item.status || "Dispatched") as DispatchStatus,
    batchId: item.batch?.lotId || item.batchId,
    partName: item.batch?.productType || payload.partName || "Bracket Motor A7",
    escalationScore:
      item.batch?.escalationScore ?? payload.escalationScore ?? 0.74,
    approvedBy: item.approvedBy || "Autonomous Vision Agent",
    sapTicketId:
      item.sapTicketId ||
      payload.sapTicketId ||
      `${(item.consumer || "SAP-QM").replace(/\s+/g, "-")}-${Math.floor(
        10000 + Math.random() * 90000
      )}`,
    defectCode: item.defectCode || payload.defectCode || "DEF-GEN-01",
    defectClass: payload.defectClass || "Anomali Mutu Manufaktur",
    actionSummary:
      payload.actionSummary ||
      `Tiket notifikasi mutu diterbitkan ke modul ${item.consumer}.`,
    supplier:
      item.batch?.supplierName ||
      payload.supplier ||
      "PT Krakatau Scrap Ind.",
  };
}

// Helper untuk menemukan dispatch berdasarkan ID tiket (e.g. DSP-2026-0419) atau sapTicketId
export async function findDispatchById(idParam: string) {
  const decoded = decodeURIComponent(idParam).trim();

  return await prisma.dispatchRecord.findFirst({
    where: {
      OR: [
        { id: decoded },
        { sapTicketId: decoded },
      ],
    },
    include: {
      batch: true,
    },
  });
}

import { prisma } from "@/lib/prisma";

// Helper untuk menghitung string waktu relatif dalam bahasa Indonesia
export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Baru saja";
  const now = new Date();
  const past = new Date(date);
  const diffMs = Math.max(0, now.getTime() - past.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${diffDays} hari lalu`;
}

// Helper formatter untuk menghasilkan response JSON Batch yang cocok 100% dengan kebutuhan frontend BatchItem
export function formatBatchRecord(item: any) {
  const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();

  return {
    id: item.lotId || item.id, // '#B-2026-0730' (kompatibel langsung dengan UI BatchItem)
    batchId: item.id, // CUID internal database
    lotId: item.lotId,
    productName: item.productType,
    productType: item.productType,
    zone: (item.storageZone || "standard") as "standard" | "quarantine",
    storageZone: item.storageZone || "standard",
    status: item.status,
    totalPcs: item.inspectionCount,
    inspectionCount: item.inspectionCount,
    defectCount: item.defectCount,
    defectTypes: Array.isArray(item.defectTypes) ? item.defectTypes : [],
    escalationScore: item.escalationScore ?? 0,
    timeAgo: formatTimeAgo(createdAt),
    createdAt: createdAt.toISOString(),
    slaSeconds: item.slaSeconds ?? (item.pendingApproval ? 780 : undefined),
    defectSummary: item.defectSummary || undefined,
    supplierName: item.supplierName || "PT Krakatau Scrap Ind.",
    line: item.line || "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
    pendingApproval: item.pendingApproval ?? false,
    inspections: item.inspections || [],
    dispatchRecords: item.dispatchRecords || [],
  };
}

// Helper untuk menemukan batch berdasarkan CUID id atau lotId (mendukung variasi dengan/tanpa prefix '#')
export async function findBatchByIdOrLot(idParam: string) {
  const decoded = decodeURIComponent(idParam).trim();
  const withHash = decoded.startsWith("#") ? decoded : `#${decoded}`;
  const withoutHash = decoded.replace(/^#/, "");

  return await prisma.batch.findFirst({
    where: {
      OR: [
        { id: decoded },
        { lotId: decoded },
        { lotId: withHash },
        { lotId: withoutHash },
        { id: withoutHash },
      ],
    },
    include: {
      inspections: {
        orderBy: { timestamp: "desc" },
        take: 20,
      },
      dispatchRecords: {
        orderBy: { dispatchedAt: "desc" },
      },
    },
  });
}

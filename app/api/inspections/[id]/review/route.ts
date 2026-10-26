import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { formatInspectionRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/inspections/[id]/review
 * Supervisor manual review of an optical inspection result.
 * Updates reviewOutcome: 'confirmed_ok' | 'confirmed_defect' | 'unresolved'.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required for inspection review");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can conduct inspection manual reviews");
  }

  const { id } = await params;
  const body = await request.json();
  const { reviewOutcome, reason } = body;

  if (
    reviewOutcome !== "confirmed_ok" &&
    reviewOutcome !== "confirmed_defect" &&
    reviewOutcome !== "unresolved"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "reviewOutcome must be 'confirmed_ok', 'confirmed_defect', or 'unresolved'",
      },
      { status: 400 }
    );
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id },
  });

  if (!inspection) {
    return NextResponse.json({ success: false, error: "Inspection not found" }, { status: 404 });
  }

  const updated = await prisma.inspection.update({
    where: { id },
    data: {
      reviewOutcome,
      reviewReason: reason || null,
      reviewedAt: new Date(),
      reviewedBy: actor.id,
      status:
        reviewOutcome === "confirmed_ok"
          ? "Lolos QC"
          : reviewOutcome === "confirmed_defect"
          ? "Ditahan"
          : "Pending Review",
    },
    include: { batch: true },
  });

  return NextResponse.json({
    success: true,
    data: formatInspectionRecord(updated),
    message: `Inspeksi ${id} berhasil ditinjau sebagai '${reviewOutcome}'`,
  });
}

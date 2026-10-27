import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse, verifyMutationAuth } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatBatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/batches/[id]/reject
 * Supervisor batch rejection endpoint with strict enterprise governance.
 * Enforces:
 * 1. Actor must be authenticated supervisor.
 * 2. CSRF enforcement on session cookie mutations.
 * 3. Required expectedBatchVersion and non-empty reason.
 * 4. Parameterized row lock on Batch row.
 * 5. Rejection preserves containment (status='rejected', storageZone='quarantine').
 * 6. Cancels unsent pending_approval actions without claiming SAP execution.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required to reject batch");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can reject batches");
  }

  const csrfCheck = verifyMutationAuth(request, actor);
  if (!csrfCheck.authorized) {
    return NextResponse.json({ success: false, error: csrfCheck.error }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON body is required" },
      { status: 400 }
    );
  }

  const { expectedBatchVersion, reason } = body;

  if (typeof expectedBatchVersion !== "number") {
    return NextResponse.json(
      { success: false, error: "expectedBatchVersion is required and must be a number" },
      { status: 422 }
    );
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(
      { success: false, error: "reason is required and cannot be empty" },
      { status: 422 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const batchLookup = await tx.batch.findFirst({
          where: { OR: [{ id }, { lotId: id }] },
          select: { id: true },
        });

        if (!batchLookup) {
          return { error: "NOT_FOUND", status: 404, message: "Batch not found" };
        }

        const batchId = batchLookup.id;
        await tx.$executeRaw`SELECT id FROM "Batch" WHERE id = ${batchId} FOR UPDATE`;

        const batch = await tx.batch.findUnique({
          where: { id: batchId },
        });

        if (!batch) {
          return { error: "NOT_FOUND", status: 404, message: "Batch not found" };
        }

        if (batch.version !== expectedBatchVersion) {
          return {
            error: "VERSION_CONFLICT",
            status: 409,
            message: `Stale batch version conflict: expected ${expectedBatchVersion}, current ${batch.version}`,
          };
        }

        // Cancel pending_approval dispatches
        await tx.dispatchRecord.updateMany({
          where: {
            batchId: batch.id,
            status: "pending_approval",
          },
          data: {
            status: "rejected",
            approvedBy: `Cancelled on batch rejection: ${reason}`,
          },
        });

        // Update batch status to rejected, quarantine zone
        const updated = await tx.batch.update({
          where: { id: batch.id },
          data: {
            status: "rejected",
            storageZone: "quarantine",
            pendingApproval: false,
            defectSummary: `Rejected by supervisor ${actor.id}: ${reason}`,
            version: { increment: 1 },
          },
        });

        return { error: null, updated };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, code: result.error, error: result.message },
        { status: result.status }
      );
    }

    const formatted = formatBatchRecord(result.updated);
    emitSigapEvent("batch:status_changed", formatted);

    return NextResponse.json({
      success: true,
      message: `Batch ${result.updated?.lotId || result.updated?.id} DITOLAK dan dialihkan ke Zona Karantina.`,
      data: formatted,
    });
  } catch (err) {
    console.error("[PATCH /api/batches/[id]/reject Unexpected Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error rejecting batch",
      },
      { status: 500 }
    );
  }
}

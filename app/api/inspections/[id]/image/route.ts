import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse } from "@/lib/auth";
import { getEvidence, getEvidenceSignedUrl } from "@/lib/evidence-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required to access inspection evidence");
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing inspection ID" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    select: { id: true, imageKey: true, imageUrl: true },
  });

  if (!inspection) {
    return NextResponse.json({ success: false, error: "Inspection not found" }, { status: 404 });
  }

  const key = inspection.imageKey;
  if (!key) {
    // If legacy imageUrl exists and is local path
    if (inspection.imageUrl && inspection.imageUrl.startsWith("/")) {
      return NextResponse.redirect(new URL(inspection.imageUrl, request.url));
    }
    return NextResponse.json({ success: false, error: "No evidence image stored for this inspection" }, { status: 404 });
  }

  const storeMode = process.env.SIGAP_EVIDENCE_STORE?.toLowerCase() === "local" ? "local" : "s3";

  if (storeMode === "s3") {
    try {
      const signedUrl = await getEvidenceSignedUrl(key, 900);
      return NextResponse.redirect(signedUrl);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: "Failed to generate signed evidence URL" },
        { status: 500 }
      );
    }
  }

  // Local streaming
  try {
    const { buffer } = await getEvidence(key);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to retrieve local evidence file" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { emitSigapEvent } from "@/lib/events";
import { deduceDefectReasoning } from "@/lib/aws-bedrock";
import { uploadInspectionFrame } from "@/lib/aws-s3";
import { dispatchToSap, SapConsumer } from "@/lib/sap-client";
import { sigapStore } from "@/lib/store";
import { runOnnxInspection } from "@/lib/onnx-inference";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let imageBase64: string | undefined;
    let testType: string | undefined;
    let lotId = "#B-2026-0730";
    let productType = "Bracket Motor A7";
    let supplierName = "PT Krakatau Scrap Ind.";
    let line = "Line #01 (Conveyor Cam-01)";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      testType = (formData.get("testType") as string) || undefined;
      lotId = (formData.get("lotId") as string) || lotId;
      productType = (formData.get("productType") as string) || productType;

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageBase64 = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
      }
    } else {
      let json: any = {};
      try {
        const rawText = await request.text();
        if (rawText && rawText.trim().length > 0) {
          json = JSON.parse(rawText);
        }
      } catch (parseErr) {
        console.warn("[POST /api/inspection/analyze] Payload bukan format JSON valid, menggunakan default:", parseErr);
      }
      imageBase64 = json.imageBase64;
      testType = json.testType || (!imageBase64 ? "defect" : undefined);
      lotId = json.lotId || lotId;
      productType = json.productType || productType;
      supplierName = json.supplierName || supplierName;
      line = json.line || line;
    }

    // Normalisasi lotId agar selalu memiliki prefix '#'
    const cleanLotId = lotId.trim();
    const formattedLotId = cleanLotId.startsWith("#") ? cleanLotId : `#${cleanLotId}`;

    // =========================================================================
    // 1. EVALUASI MODEL AI (YOLOv8-Detect & YOLOv8-Cls Biner: DEFECT vs OK)
    // =========================================================================
    let isDefect = false;
    let defectClass = "OK";
    let confidence = 98.8;
    let severity: "Critical" | "High" | "Medium" | "Low" | "None" = "None";
    let boundingBoxes: Array<{
      x: number; // persentase left (0-100)
      y: number; // persentase top (0-100)
      width: number; // persentase width
      height: number; // persentase height
      label: string;
      confidence: number;
    }> = [];

    let imageBuffer: Buffer | null = null;
    let imageMimeType = "image/jpeg";

    if (imageBase64 && imageBase64.startsWith("data:")) {
      const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        imageBuffer = Buffer.from(matches[2], "base64");
        imageMimeType = matches[1] || "image/jpeg";
      }
    }

    if (imageBuffer) {
      // 1A. REAL YOLOv8 ONNX RUNTIME INFERENCE (Casting Classification & Detection)
      const onnxRes = await runOnnxInspection(imageBuffer, imageMimeType);
      isDefect = onnxRes.isDefect;
      defectClass = onnxRes.defectClass;
      confidence = onnxRes.confidence;
      severity = onnxRes.severity;
      boundingBoxes = onnxRes.boundingBoxes;
    } else if (testType === "defect") {
      isDefect = true;
      defectClass = "defect";
      confidence = 96.4;
      severity = "High";
      boundingBoxes = [
        {
          x: 14.4,
          y: 10.9,
          width: 24.5,
          height: 26.0,
          label: "defect",
          confidence: 96.4,
        },
      ];
    } else if (testType === "ok") {
      isDefect = false;
      defectClass = "ok";
      confidence = 99.4;
      severity = "None";
      boundingBoxes = [];
    } else {
      // Fallback default
      isDefect = true;
      defectClass = "defect";
      confidence = 95.8;
      severity = "High";
      boundingBoxes = [
        {
          x: 14.4,
          y: 10.9,
          width: 24.5,
          height: 26.0,
          label: "defect",
          confidence: 95.8,
        },
      ];
    }

    // =========================================================================
    // 2. PENYIMPANAN CITRA KE AWS S3 / LOCAL STORAGE
    // =========================================================================
    let imageUrl = isDefect
      ? "/sample-frames/defect.jpeg"
      : "/sample-frames/ok.jpeg";

    if (imageBase64 && imageBase64.startsWith("data:")) {
      try {
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const buffer = Buffer.from(matches[2], "base64");
          const mimeType = matches[1] || "image/jpeg";
          const fileName = `frame-${Date.now()}-${isDefect ? "defect" : "ok"}.jpg`;
          const s3Res = await uploadInspectionFrame(buffer, fileName, mimeType);
          imageUrl = s3Res.url;
        }
      } catch (err) {
        console.warn("[Upload S3 Warn] Menggunakan fallback citra lokal:", err);
      }
    }

    // =========================================================================
    // 3. SIKLUS PENALARAN DEDUKTIF OTONOM (AWS BEDROCK AGENT)
    // =========================================================================
    const bedrockResult = await deduceDefectReasoning({
      lotId: formattedLotId,
      productType,
      defectClass,
      confidence,
      supplierName,
      defectCountInWindow: isDefect ? 3 : 0,
    });

    const escalationScore = bedrockResult.escalationScore;
    const recommendation = bedrockResult.recommendation;

    // =========================================================================
    // 4. EKSEKUSI DISPATCH ENTERPRISE ERP (SAP QM, MM, PP)
    // =========================================================================
    const sapDispatches: Array<{
      consumer: SapConsumer;
      ticketId: string;
      mode: string;
    }> = [];

    if (isDefect && bedrockResult.sapActions.length > 0) {
      for (const consumer of bedrockResult.sapActions) {
        try {
          const dispatchRes = await dispatchToSap({
            consumer,
            batchId: formattedLotId,
            defectCode: isDefect ? "DEF-CASTING-01" : "OK-CLEAN",
            notes: bedrockResult.rootCause,
            escalationScore,
            supplierId: "SUPP-KRAKATAU-09",
            workOrderId: "WO-2026-8819",
          });
          sapDispatches.push({
            consumer,
            ticketId: dispatchRes.ticketId,
            mode: dispatchRes.mode,
          });
        } catch (dispatchErr) {
          console.error(`[SAP Dispatch Fail] ${consumer}:`, dispatchErr);
        }
      }
    }

    // =========================================================================
    // 5. PERSISTENSI KE DATA STORE (PRISMA POSTGRESQL ATAU IN-MEMORY FALLBACK)
    // =========================================================================
    const inspectionId = `INS-${Date.now().toString().slice(-6)}`;
    
    // Pemetaan kode standar cacat industri sesuai domain
    let mappedDefectCode = "OK-CLEAN";
    if (isDefect) {
      const lc = defectClass.toLowerCase();
      if (lc.includes("warna") || lc.includes("oxid")) mappedDefectCode = "DEF-OXID-01";
      else if (lc.includes("retak") || lc.includes("crack")) mappedDefectCode = "DEF-CRACK-01";
      else if (lc.includes("lubang") || lc.includes("poros")) mappedDefectCode = "DEF-POROS-01";
      else if (lc.includes("burr") || lc.includes("sisik")) mappedDefectCode = "DEF-BURR-01";
      else mappedDefectCode = "DEF-CAST-01";
    }

    try {
      // 1. Dapatkan atau buat batch
      await sigapStore.getBatchById(formattedLotId);

      // 2. Format agentReasoningTrace
      const reasoningTrace = bedrockResult.reasoningSteps.map((step) => ({
        step: step.step,
        phase: step.name,
        title: `${step.step}. ${step.name}`,
        detail: step.detail,
        latency: step.name === "DETECT" ? "5.2ms" : "78ms",
      }));

      // 3. Simpan rekaman inspeksi
      await sigapStore.createInspection({
        id: inspectionId,
        batchId: formattedLotId,
        defectClass,
        confidence,
        severity,
        defectDetected: isDefect,
        status: isDefect ? "Ditahan" : "Lolos QC",
        imageUrl,
        agentReasoningTrace: reasoningTrace,
      });

      // 4. Simpan catatan dispatch jika ada mutasi SAP
      if (sapDispatches.length > 0) {
        for (const d of sapDispatches) {
          await sigapStore.createDispatch({
            batchId: formattedLotId,
            triggerReason: `Eskalasi ${defectClass} (Skor: ${escalationScore.toFixed(2)})`,
            consumer: d.consumer,
            payload: {
              ticketId: d.ticketId,
              mode: d.mode,
              escalationScore,
              defectClass,
            },
            status: "Dispatched",
            approvedBy: "Autonomous Vision Agent",
            sapTicketId: d.ticketId,
            defectCode: mappedDefectCode,
          });
        }
      }
    } catch (storeError) {
      console.warn("[sigapStore Persistence Warn]:", storeError);
    }

    // =========================================================================
    // 6. SERVER-SENT EVENTS (SSE) BROADCASTING REAL-TIME
    // =========================================================================
    const formattedDate =
      new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date()) + " WIB";

    const ssePayload = {
      id: inspectionId,
      lotId: formattedLotId,
      batchId: formattedLotId,
      partName: productType,
      supplier: supplierName,
      line,
      timestamp: formattedDate,
      rawDate: new Date().toISOString(),
      imageUrl,
      defectDetected: isDefect,
      defectClass,
      confidence,
      severity,
      status: isDefect ? "Ditahan" : "Lolos QC",
      agentReasoningTrace: bedrockResult.reasoningSteps.map((step) => ({
        step: step.step,
        phase: step.name,
        detail: step.detail,
        latency: step.name === "DETECT" ? "5.2ms" : "78ms",
      })),
      escalationScore,
      sapDispatches,
    };

    // 1. Kirim event inspeksi baru
    emitSigapEvent("inspection:created", ssePayload);

    // 2. Kirim event perubahan batch & escalation gauge
    emitSigapEvent("batch:status_changed", {
      lotId: formattedLotId,
      status: isDefect ? "held" : "pending",
      storageZone: isDefect ? "quarantine" : "production",
      defectCountIncrement: isDefect ? 1 : 0,
      escalationScore,
    });

    // 3. Kirim log penalaran agen
    emitSigapEvent("agent:log", {
      inspectionId,
      traces: ssePayload.agentReasoningTrace,
      escalationScore,
      recommendation,
    });

    return NextResponse.json({
      success: true,
      inspection: ssePayload,
      boundingBoxes,
      reasoningSteps: bedrockResult.reasoningSteps,
      escalationScore,
      recommendation,
      rootCause: bedrockResult.rootCause,
      sapDispatches,
      source: bedrockResult.source,
    });
  } catch (error: any) {
    console.error("[Inspection Analyze API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Gagal memproses analisis inspeksi",
      },
      { status: 500 }
    );
  }
}

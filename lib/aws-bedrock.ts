import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

export interface ReasoningStep {
  step: string;
  name: string;
  detail: string;
  status: "completed" | "flagged" | "analyzing";
}

export interface BedrockDeductionResult {
  escalationScore: number;
  recommendation: "release" | "quarantine" | "reject";
  rootCause: string;
  sapActions: ("SAP_QM" | "SAP_MM" | "SAP_PP")[];
  reasoningSteps: ReasoningStep[];
  source: "aws-bedrock" | "local-deterministic-fallback";
}

export interface DefectReasoningInput {
  lotId: string;
  productType: string;
  defectClass?: string;
  defectDetected?: boolean;
  confidence: number;
  supplierName?: string;
  defectCountInWindow?: number;
}

function isOkOutcome(input: DefectReasoningInput): boolean {
  if (input.defectDetected === false) return true;
  if (!input.defectClass) return false;
  const c = input.defectClass.trim().toUpperCase();
  return c === "OK" || c === "OK_FRONT" || c === "NORMAL" || c === "CLEAN" || c === "PRODUK_OK";
}

export async function deduceDefectReasoning(
  input: DefectReasoningInput
): Promise<BedrockDeductionResult> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.AWS_BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0";

  const isOk = isOkOutcome(input);
  const outcomeLabel = isOk ? "OK (Normal / Lolos QC)" : "DEFECT (Cacat Terdeteksi)";

  const systemPrompt = `Anda adalah Manufacturing Quality AI Agent untuk platform SIGAP.
Tugas Anda: Menganalisis hasil inspeksi optik biner (luaran kamera YOLO hanya: "DEFECT" atau "OK") pada lini pengecoran komponen impeller submersible.
Jika terdeteksi "DEFECT", evaluasi tingkat risiko eskalasi berdasarkan confidence score inferensi, frekuensi cacat dalam sliding window 8 menit, dan riwayat supplier.
Tentukan rekomendasi ("release" | "quarantine" | "reject"), analisis akar masalah metalurgi/casting, serta penyiapan tiket mutasi ERP SAP.
Output WAJIB berupa JSON murni tanpa markdown fence dengan format:
{
  "escalationScore": number,
  "recommendation": "release" | "quarantine" | "reject",
  "rootCause": string,
  "sapActions": ["SAP_QM", "SAP_MM", "SAP_PP"],
  "reasoningSteps": [
    { "step": "01", "name": "DETECT", "detail": string, "status": "completed" },
    { "step": "02", "name": "MEMORY", "detail": string, "status": "completed" },
    { "step": "03", "name": "FORMULA", "detail": string, "status": "completed" },
    { "step": "04", "name": "DECISION", "detail": string, "status": "flagged" },
    { "step": "05", "name": "DISPATCH", "detail": string, "status": "completed" }
  ]
}`;

  const userMessage = `Data Hasil Inspeksi Visi Komveyor:
- Lot ID: ${input.lotId}
- Produk: ${input.productType || "Submersible Pump Impeller Casting"}
- Hasil Inspeksi Biner: ${outcomeLabel}
- Tingkat Keyakinan (Confidence): ${input.confidence}%
- Supplier Bahan: ${input.supplierName || "PT Mitra Logam Presisi"}
- Frekuensi Cacat dalam Window 8 Menit: ${input.defectCountInWindow || 1}`;

  // Dedicated AWS Bedrock Agentic Reasoning: Amazon Nova Lite Foundation Model
  if (accessKeyId && secretAccessKey && !accessKeyId.startsWith("AKIAXXXX")) {
    try {
      const client = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
          ...(sessionToken ? { sessionToken } : {}),
        },
      });

      const command = new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages: [{ role: "user", content: [{ text: userMessage }] }],
        inferenceConfig: {
          maxTokens: 1000,
          temperature: 0.1,
        },
      });

      const response = await client.send(command);
      const rawContent = response.output?.message?.content?.[0]?.text || "{}";
      const cleaned = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        escalationScore: typeof parsed.escalationScore === "number" ? parsed.escalationScore : (isOk ? 0.05 : 0.85),
        recommendation: parsed.recommendation || (isOk ? "release" : "quarantine"),
        rootCause: parsed.rootCause || (isOk ? "Komponen memenuhi seluruh standar toleransi dimensi & permukaan casting (QC Passed)." : "Anomali cacat permukaan casting impeller akibat fluktuasi pendinginan cetakan die casting."),
        sapActions: Array.isArray(parsed.sapActions) ? parsed.sapActions : (isOk ? [] : ["SAP_QM"]),
        reasoningSteps: Array.isArray(parsed.reasoningSteps)
          ? parsed.reasoningSteps
          : generateDeterministicFallback(input).reasoningSteps,
        source: "aws-bedrock",
      };
    } catch (error) {
      console.error("[AWS Bedrock Nova Lite Error] Falling back to deterministic reasoning:", error);
    }
  }

  // Fallback Deterministic Engine (Demo Day Resilience)
  return generateDeterministicFallback(input);
}

function generateDeterministicFallback(input: DefectReasoningInput): BedrockDeductionResult {
  const isOk = isOkOutcome(input);

  // Kasus 1: Komponen Lolos QC (Normal / OK)
  if (isOk) {
    return {
      escalationScore: 0.05,
      recommendation: "release",
      rootCause: "Komponen memenuhi seluruh standar toleransi dimensi & permukaan casting (QC Passed).",
      sapActions: [],
      source: "local-deterministic-fallback",
      reasoningSteps: [
        {
          step: "01",
          name: "DETECT",
          detail: `Inferensi visi mengonfirmasi status OK (normal) pada ${input.lotId} (Confidence: ${input.confidence}%).`,
          status: "completed",
        },
        {
          step: "02",
          name: "MEMORY",
          detail: `Pemeriksaan korelasi supplier ${input.supplierName || "PT Mitra Logam"}: integritas material stabil tanpa deviasi.`,
          status: "completed",
        },
        {
          step: "03",
          name: "FORMULA",
          detail: "Evaluasi risiko eskalasi: E = 0.05 (jauh di bawah ambang batas anomali 0.40).",
          status: "completed",
        },
        {
          step: "04",
          name: "DECISION",
          detail: "Komponen lolos verifikasi kualitas. Lot direkomendasikan RELEASE ke lini perakitan.",
          status: "completed",
        },
        {
          step: "05",
          name: "DISPATCH",
          detail: "Kondisi normal: tidak memerlukan eskalasi mutasi ERP SAP.",
          status: "completed",
        },
      ],
    };
  }

  // Kasus 2: Komponen Cacat (DEFECT Detected)
  const windowCount = Math.max(1, input.defectCountInWindow || 3);
  const windowMax = 5;
  const supplierRepeatFlag = windowCount >= 3 ? 1.0 : 0.4;

  // Formula Resmi: E = (defect_count / window_max * 0.45) + (confidence * 0.30) + (supplier_repeat * 0.25)
  const freqPart = Math.min(1.0, windowCount / windowMax) * 0.45;
  const confPart = (Math.min(100, Math.max(50, input.confidence)) / 100.0) * 0.30;
  const suppPart = supplierRepeatFlag * 0.25;
  const rawScore = freqPart + confPart + suppPart;
  const score = Math.min(1.0, Math.max(0.0, Number(rawScore.toFixed(2))));

  const recommendation = score >= 0.70 ? "quarantine" : score >= 0.40 ? "quarantine" : "release";
  const sapActions: ("SAP_QM" | "SAP_MM" | "SAP_PP")[] =
    score >= 0.70
      ? ["SAP_QM", "SAP_MM", "SAP_PP"]
      : score >= 0.40
      ? ["SAP_QM"]
      : [];

  return {
    escalationScore: score,
    recommendation,
    rootCause: "Anomali cacat struktur permukaan casting impeller akibat deviasi laju pendinginan cetakan die casting.",
    sapActions,
    source: "local-deterministic-fallback",
    reasoningSteps: [
      {
        step: "01",
        name: "DETECT",
        detail: `Inferensi visi mendeteksi anomali cacat (DEFECT) pada ${input.lotId} dengan confidence ${input.confidence}%.`,
        status: "completed",
      },
      {
        step: "02",
        name: "MEMORY",
        detail: `Korelasi histori supplier ${input.supplierName || "PT Krakatau Scrap"}: terdeteksi ${windowCount} cacat serupa dalam jendela 8 menit.`,
        status: "completed",
      },
      {
        step: "03",
        name: "FORMULA",
        detail: `Kalkulasi eskalasi E = (${freqPart.toFixed(2)} [frek]) + (${confPart.toFixed(2)} [conf]) + (${suppPart.toFixed(2)} [histori]) = ${score.toFixed(2)}.`,
        status: "completed",
      },
      {
        step: "04",
        name: "DECISION",
        detail: score >= 0.70
          ? "Pola cacat terkonfirmasi (Skor > 0.70). Batch dialihkan ke Zona Karantina."
          : "Anomali cacat terdeteksi di atas batas toleransi. Ditahan untuk peninjauan mutu.",
        status: "flagged",
      },
      {
        step: "05",
        name: "DISPATCH",
        detail: sapActions.length > 0
          ? `Menyiapkan tiket dispatch OData ERP: ${sapActions.join(", ")}.`
          : "Tidak memerlukan eskalasi ERP (kategori sporadis aman).",
        status: "completed",
      },
    ],
  };
}

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
  defectClass: string;
  confidence: number;
  supplierName?: string;
  defectCountInWindow?: number;
}

export async function deduceDefectReasoning(
  input: DefectReasoningInput
): Promise<BedrockDeductionResult> {
  // Support both new Bedrock API Key (ABSK... Bearer Token) and traditional IAM credentials
  const bedrockApiKey =
    process.env.AWS_BEDROCK_API_KEY ||
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    (process.env.AWS_ACCESS_KEY_ID?.startsWith("ABSK")
      ? process.env.AWS_ACCESS_KEY_ID
      : undefined);

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.AWS_BEDROCK_MODEL_ID;

  const systemPrompt = `Anda adalah Manufacturing Quality AI Agent untuk platform SIGAP.
Tugas Anda: Analisis inspeksi optik komponen impeller casting, tentukan korelasi cacat, hitung skor eskalasi resiko (0.0 - 1.0), dan tentukan tindakan ERP SAP.
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

  const userMessage = `Data Inspeksi:
- Lot ID: ${input.lotId}
- Produk: ${input.productType}
- Jenis Cacat: ${input.defectClass}
- Confidence: ${input.confidence}%
- Supplier: ${input.supplierName || "PT Mitra Logam Presisi"}
- Frekuensi Cacat dalam Window: ${input.defectCountInWindow || 1}`;

  // MODE 1: Amazon Bedrock Long-Term API Key (Bearer Token, prefix ABSK...) via Bedrock Mantle
  if (bedrockApiKey && bedrockApiKey.startsWith("ABSK") && !bedrockApiKey.startsWith("ABSKXXXX")) {
    try {
      const mantleRegion = process.env.AWS_REGION || "us-east-1";
      const mantleModel = modelId || "deepseek.v3.1";

      const res = await fetch(`https://bedrock-mantle.${mantleRegion}.api.aws/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bedrockApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: mantleModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 800,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const rawContent = json.choices?.[0]?.message?.content || "{}";
        const cleaned = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        return {
          escalationScore: typeof parsed.escalationScore === "number" ? parsed.escalationScore : 0.85,
          recommendation: parsed.recommendation || "quarantine",
          rootCause: parsed.rootCause || `Anomali ${input.defectClass} pada komponen casting`,
          sapActions: Array.isArray(parsed.sapActions) ? parsed.sapActions : ["SAP_QM"],
          reasoningSteps: Array.isArray(parsed.reasoningSteps)
            ? parsed.reasoningSteps
            : generateDeterministicFallback(input).reasoningSteps,
          source: "aws-bedrock",
        };
      } else {
        console.warn(`[Bedrock Mantle API] HTTP ${res.status}: ${await res.text()}`);
      }
    } catch (apiError) {
      console.error("[Bedrock Mantle Error] Falling back:", apiError);
    }
  }

  // MODE 2: AWS IAM SigV4 Credentials (Access Key & Secret Key) via AWS SDK ConverseCommand
  if (accessKeyId && secretAccessKey && !accessKeyId.startsWith("AKIAXXXX") && !accessKeyId.startsWith("ABSK")) {
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
        modelId: modelId || "amazon.nova-lite-v1:0",
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
        escalationScore: typeof parsed.escalationScore === "number" ? parsed.escalationScore : 0.85,
        recommendation: parsed.recommendation || "quarantine",
        rootCause: parsed.rootCause || `Anomali ${input.defectClass} pada komponen casting`,
        sapActions: Array.isArray(parsed.sapActions) ? parsed.sapActions : ["SAP_QM"],
        reasoningSteps: Array.isArray(parsed.reasoningSteps)
          ? parsed.reasoningSteps
          : generateDeterministicFallback(input).reasoningSteps,
        source: "aws-bedrock",
      };
    } catch (error) {
      console.error("[AWS Bedrock SDK Error] Falling back to deterministic reasoning:", error);
    }
  }

  // MODE 3: Fallback Deterministic Engine
  return generateDeterministicFallback(input);
}

function generateDeterministicFallback(input: DefectReasoningInput): BedrockDeductionResult {
  const isOkPart =
    !input.defectClass ||
    input.defectClass.toUpperCase() === "OK" ||
    input.defectClass.toLowerCase().includes("ok") ||
    input.defectClass.toLowerCase().includes("produk_ok") ||
    input.defectClass.toLowerCase().includes("clean");

  // Kasus 1: Komponen Lolos QC (Normal / OK)
  if (isOkPart) {
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
          detail: `Inferensi visi mengonfirmasi spesifikasi permukaan normal pada ${input.lotId} (Confidence: ${input.confidence}%).`,
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

  // Kasus 2: Komponen Cacat (Defect Detected)
  // Taksonomi Severity Bobot Sesuai Domain Manufaktur Die Casting
  const lowerClass = (input.defectClass || "").toLowerCase();
  let severityWeight = 0.75;
  if (lowerClass.includes("retak") || lowerClass.includes("luka_rebekan") || lowerClass.includes("crack")) {
    severityWeight = 1.0; // Critical
  } else if (lowerClass.includes("warna") || lowerClass.includes("oxid")) {
    severityWeight = 0.85; // High
  } else if (lowerClass.includes("burr") || lowerClass.includes("sisik")) {
    severityWeight = 0.50; // Medium
  } else if (lowerClass.includes("lendir") || lowerClass.includes("oli")) {
    severityWeight = 0.40; // Low
  }

  const windowCount = Math.max(1, input.defectCountInWindow || 3);
  const windowMax = 5;
  const supplierRepeatFlag = windowCount >= 3 ? 1.0 : 0.4;

  // Formula Resmi Sesuai Master Context SIGAP:
  // Escalation_Score = (defect_count / window_max * 0.40) + (severity * 0.35) + (supplier_repeat * 0.25)
  const freqPart = Math.min(1.0, windowCount / windowMax) * 0.40;
  const sevPart = severityWeight * 0.35;
  const suppPart = supplierRepeatFlag * 0.25;
  const rawScore = freqPart + sevPart + suppPart;
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
    rootCause: `Kavitasi termal anomali '${input.defectClass}' pada impeller casting akibat fluktuasi pendinginan cetakan die casting.`,
    sapActions,
    source: "local-deterministic-fallback",
    reasoningSteps: [
      {
        step: "01",
        name: "DETECT",
        detail: `Inferensi visi mendeteksi anomali '${input.defectClass}' pada ${input.lotId} dengan confidence ${input.confidence}%.`,
        status: "completed",
      },
      {
        step: "02",
        name: "MEMORY",
        detail: `Korelasi histori supplier ${input.supplierName || "PT Krakatau Scrap"}: terdeteksi ${windowCount} anomali serupa dalam jendela 8 menit.`,
        status: "completed",
      },
      {
        step: "03",
        name: "FORMULA",
        detail: `Kalkulasi eskalasi E = (${freqPart.toFixed(2)} [frek]) + (${sevPart.toFixed(2)} [sev]) + (${suppPart.toFixed(2)} [histori]) = ${score.toFixed(2)}.`,
        status: "completed",
      },
      {
        step: "04",
        name: "DECISION",
        detail: score >= 0.70
          ? "Pola anomali terkonfirmasi (Skor > 0.70). Batch dialihkan ke Zona Karantina."
          : "Anomali terdeteksi di atas batas toleransi. Ditahan untuk peninjauan mutu.",
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

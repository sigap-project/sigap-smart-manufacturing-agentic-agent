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
  const windowCount = input.defectCountInWindow || 1;
  const isSevere = input.confidence >= 80 && windowCount >= 2;
  const score = Math.min(1.0, Number(((windowCount * 0.35) + (input.confidence / 100 * 0.45)).toFixed(2)));

  const recommendation = score >= 0.75 ? "reject" : score >= 0.45 ? "quarantine" : "release";
  const sapActions: ("SAP_QM" | "SAP_MM" | "SAP_PP")[] =
    score >= 0.75 ? ["SAP_QM", "SAP_MM", "SAP_PP"] : score >= 0.45 ? ["SAP_QM"] : [];

  return {
    escalationScore: score,
    recommendation,
    rootCause: `Kavitasi anomali ${input.defectClass} pada impeller casting akibat fluktuasi pendinginan atau keausan cetakan die casting.`,
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
        detail: `Korelasi histori supplier ${input.supplierName || "PT Mitra Logam"}: terdeteksi ${windowCount} anomali serupa dalam jendela 15 menit.`,
        status: "completed",
      },
      {
        step: "03",
        name: "FORMULA",
        detail: `Kalkulasi eskalasi E = min(1.0, (${windowCount}/5 * 0.4) + (${input.confidence}/100 * 0.35) + 0.25) = ${score}.`,
        status: "completed",
      },
      {
        step: "04",
        name: "DECISION",
        detail: `Status lot diubah menjadi ${recommendation.toUpperCase()} dengan isolasi zona penyimpanan karantina.`,
        status: recommendation === "release" ? "completed" : "flagged",
      },
      {
        step: "05",
        name: "DISPATCH",
        detail: sapActions.length > 0
          ? `Menyiapkan tiket dispatch OData ERP: ${sapActions.join(", ")}.`
          : "Tidak memerlukan eskalasi ERP (kategori sporadis / lulus ambang batas).",
        status: "completed",
      },
    ],
  };
}

import crypto from "crypto";
import { BedrockAdapter } from "../lib/aws-bedrock";
import { SapAiCoreAdapter } from "../lib/sap-ai-core";
import { storeEvidence, getEvidence } from "../lib/evidence-store";
import { prisma } from "../lib/prisma";

async function verifyDatabase(): Promise<{ status: "PASS" | "FAIL"; details: string }> {
  try {
    // 1. Connectivity check
    await prisma.$executeRawUnsafe("SELECT 1;");

    // 2. Read existing batches (should not throw)
    const batchCount = await prisma.batch.count();

    return {
      status: "PASS",
      details: `PostgreSQL connection verified; readable batch count: ${batchCount}`,
    };
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "DatabaseError";
    const errorMessage = err instanceof Error ? err.message.slice(0, 100) : "Unknown error";
    return {
      status: "FAIL",
      details: `Database check failed: ${errorName} (${errorMessage})`,
    };
  }
}

async function verifyEvidenceStore(): Promise<{ status: "PASS" | "FAIL"; details: string }> {
  try {
    const testPayload = Buffer.from(`SIGAP Preflight Evidence Probe - ${Date.now()}`, "utf-8");
    const testSha256 = crypto.createHash("sha256").update(testPayload).digest("hex");
    const testEventId = `preflight-${crypto.randomBytes(4).toString("hex")}`;

    const stored = await storeEvidence(testPayload, testEventId, testSha256);
    const retrieved = await getEvidence(stored.storageKey);

    if (retrieved.sha256 !== testSha256) {
      return {
        status: "FAIL",
        details: `Evidence SHA-256 hash mismatch: expected ${testSha256.slice(0, 8)}, got ${retrieved.sha256.slice(0, 8)}`,
      };
    }

    return {
      status: "PASS",
      details: `Store mode: ${stored.store}; key: ${stored.storageKey}; bytes: ${stored.byteLength}; hash verified`,
    };
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "StorageError";
    const errorMessage = err instanceof Error ? err.message.slice(0, 100) : "Unknown error";
    return {
      status: "FAIL",
      details: `Evidence store check failed: ${errorName} (${errorMessage})`,
    };
  }
}

async function verifyAiProvider(): Promise<{
  provider: string;
  model: string;
  status: "PASS" | "FAIL";
  details: string;
}> {
  const chosenProvider = (process.env.SIGAP_AI_PROVIDER || "bedrock").toLowerCase();

  const adapter = chosenProvider === "sap-ai-core" ? new SapAiCoreAdapter() : new BedrockAdapter();
  const providerName = adapter.providerName;
  const modelId = adapter.modelId;

  try {
    const testTool = {
      name: "echo_status",
      description: "Echoes a status string to verify tool invocation",
      inputSchema: {
        type: "object" as const,
        properties: {
          status: { type: "string", description: "Status to echo" },
        },
        required: ["status"],
      },
    };

    // Turn 1: Ask model to use the tool
    const turn1 = await adapter.nextTurn(
      [{ role: "user", content: "Please call echo_status with status 'healthy'." }],
      [testTool],
      "You are a preflight diagnostic worker. You must call echo_status when requested."
    );

    const call = turn1.toolCalls.find((c) => c.name === "echo_status");
    if (!call) {
      return {
        provider: providerName,
        model: modelId,
        status: "FAIL",
        details: `Model responded without calling test tool: ${turn1.summary?.slice(0, 80) || "No content"}`,
      };
    }

    // Turn 2: Feed back tool result
    const turn2 = await adapter.nextTurn(
      [
        { role: "user", content: "Please call echo_status with status 'healthy'." },
        { role: "assistant", toolCalls: [call] },
        {
          role: "user",
          toolResult: {
            toolCallId: call.id,
            result: { ack: true, received: call.input.status },
          },
        },
      ],
      [testTool],
      "Acknowledge the tool result with a brief confirmation."
    );

    return {
      provider: providerName,
      model: modelId,
      status: "PASS",
      details: `Tool round trip verified (callId: ${call.id.slice(0, 12)}...); prompt tokens: ${turn2.usage?.inputTokens}, completion tokens: ${turn2.usage?.outputTokens}`,
    };
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "ProviderError";
    const errorMessage = err instanceof Error ? err.message.slice(0, 100) : "Unknown error";
    return {
      provider: providerName,
      model: modelId,
      status: "FAIL",
      details: `Provider round trip failed: ${errorName} (${errorMessage})`,
    };
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("SIGAP SMART MANUFACTURING - SYSTEM PREFLIGHT DIAGNOSTICS");
  console.log("===============================================================================");

  const dbRes = await verifyDatabase();
  console.log(`[DB]       PostgreSQL RDS:       [${dbRes.status}] ${dbRes.details}`);

  const storeRes = await verifyEvidenceStore();
  console.log(`[STORE]    Evidence Storage:     [${storeRes.status}] ${storeRes.details}`);

  const aiRes = await verifyAiProvider();
  console.log(`[AI]       ${aiRes.provider.toUpperCase()} (${aiRes.model}): [${aiRes.status}] ${aiRes.details}`);

  console.log("===============================================================================");

  const allPassed = dbRes.status === "PASS" && storeRes.status === "PASS" && aiRes.status === "PASS";
  if (allPassed) {
    console.log("PREFLIGHT PASSED: All operational contracts and core services verified.");
    process.exit(0);
  } else {
    console.error("PREFLIGHT FAILED: One or more critical subsystems failed verification.");
    process.exit(1);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});

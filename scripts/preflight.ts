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
    const toolContext = {
      name: "get_context",
      description: "Retrieves inspection and station context",
      inputSchema: { type: "object" as const, properties: {} },
    };
    const toolPolicy = {
      name: "get_policy",
      description: "Retrieves quality escalation policy",
      inputSchema: { type: "object" as const, properties: {} },
    };

    // Turn 1: Ask model to call both tools
    const turn1 = await adapter.nextTurn(
      [{ role: "user", content: "Call both get_context and get_policy tools to evaluate station status." }],
      [toolContext, toolPolicy],
      "You are a preflight diagnostic worker. You must call both get_context and get_policy tools."
    );

    const calledNames = new Set(turn1.toolCalls.map((tc) => tc.name));
    if (!calledNames.has("get_context") || !calledNames.has("get_policy")) {
      return {
        provider: providerName,
        model: modelId,
        status: "FAIL",
        details: `Model failed to invoke both required tools (called: ${Array.from(calledNames).join(", ") || "none"})`,
      };
    }

    const toolResults = turn1.toolCalls.map((tc) => {
      if (tc.name === "get_context") {
        return {
          toolCallId: tc.id,
          result: { stationId: "station-01", status: "operational" },
        };
      }
      if (tc.name === "get_policy") {
        return {
          toolCallId: tc.id,
          result: { threshold: 3, windowMinutes: 8 },
        };
      }
      return {
        toolCallId: tc.id,
        result: { status: "unknown_tool" },
      };
    });

    // Turn 2: Feed back plural tool observations and verify subsequent decision synthesis
    const turn2 = await adapter.nextTurn(
      [
        { role: "user", content: "Call both get_context and get_policy tools to evaluate station status." },
        { role: "assistant", toolCalls: turn1.toolCalls },
        {
          role: "user",
          toolResults,
        },
      ],
      [toolContext, toolPolicy],
      "Synthesize both tool observations into a concise confirmation statement citing both stationId and threshold."
    );

    if (turn2.toolCalls && turn2.toolCalls.length > 0) {
      return {
        provider: providerName,
        model: modelId,
        status: "FAIL",
        details: `Turn 2 produced unresolved tool calls instead of terminal decision synthesis: ${turn2.toolCalls.map((t) => t.name).join(", ")}`,
      };
    }

    const summaryText = turn2.summary || "";
    const lowerSummary = summaryText.toLowerCase();
    const hasStation = lowerSummary.includes("station-01");
    const hasThreshold = /\b3\b/.test(summaryText) || summaryText.includes("3");
    if (!hasStation || !hasThreshold) {
      return {
        provider: providerName,
        model: modelId,
        status: "FAIL",
        details: `Decision synthesis missing required factual grounding (station-01: ${hasStation}, threshold 3: ${hasThreshold}): "${summaryText.slice(0, 100)}"`,
      };
    }

    return {
      provider: providerName,
      model: modelId,
      status: "PASS",
      details: `Two-tool observation round trip verified (${turn1.toolCalls.length} tool calls synthesized into decision); prompt tokens: ${turn2.usage?.inputTokens}, completion tokens: ${turn2.usage?.outputTokens}`,
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
  const isAiOnly = process.argv.includes("--ai-only");

  console.log("===============================================================================");
  console.log(`SIGAP SMART MANUFACTURING - SYSTEM PREFLIGHT DIAGNOSTICS${isAiOnly ? " (AI ONLY)" : ""}`);
  console.log("===============================================================================");

  if (isAiOnly) {
    const aiRes = await verifyAiProvider();
    console.log(`[AI]       ${aiRes.provider.toUpperCase()} (${aiRes.model}): [${aiRes.status}] ${aiRes.details}`);
    console.log("===============================================================================");
    if (aiRes.status === "PASS") {
      console.log("PREFLIGHT PASSED: AI provider verified.");
      process.exit(0);
    } else {
      console.error("PREFLIGHT FAILED: AI provider verification failed.");
      process.exit(1);
    }
  }

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

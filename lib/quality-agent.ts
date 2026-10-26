import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { BedrockAdapter } from "./aws-bedrock";
import { SapAiCoreAdapter } from "./sap-ai-core";
import {
  ActionType,
  AgentTurnMessage,
  AIProviderAdapter,
  ToolCall,
  ToolDefinition,
} from "./contracts";
import { emitSigapEvent } from "./events";
import { prisma } from "./prisma";

interface QualityPolicy {
  policyId: string;
  version: number;
  slidingWindowMinutes: number;
  escalationDefectTrigger: number;
  defaultAutoDispatchMode: string;
  allowedActions: Array<{
    actionType: ActionType;
    requiredDefectCount: number;
    requiresSupervisorApproval: boolean;
    erpConsumer: string;
    description: string;
  }>;
  supplierHistory: Record<string, unknown>;
}

async function loadPolicy(): Promise<QualityPolicy> {
  const policyPath = path.join(process.cwd(), "data", "quality-policy.json");
  const raw = await fs.readFile(policyPath, "utf-8");
  return JSON.parse(raw) as QualityPolicy;
}

function getAIAdapter(): AIProviderAdapter {
  const provider = (process.env.SIGAP_AI_PROVIDER || "bedrock").toLowerCase();
  return provider === "sap-ai-core" ? new SapAiCoreAdapter() : new BedrockAdapter();
}

export async function runQualityWorkflow(runId: string): Promise<void> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      inspection: true,
      batch: true,
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun ${runId} not found`);
  }

  const { inspection, batch } = run;
  const policy = await loadPolicy();
  const adapter = getAIAdapter();

  // If inspection is OK, record deterministic pass without calling external LLM
  if (inspection.outcome === "ok") {
    let nextSeq = 2;

    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: nextSeq++,
        step: "02",
        stepName: "MEMORY",
        stage: "MEMORY",
        kind: "decision",
        status: "completed",
        output: { result: "OK inspection verified; no anomaly pattern detected." },
      },
    });

    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: nextSeq++,
        step: "03",
        stepName: "FORMULA",
        stage: "FORMULA",
        kind: "decision",
        status: "completed",
        output: { distinctDefectsInWindow: 0, threshold: policy.escalationDefectTrigger, thresholdBreached: false },
      },
    });

    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: nextSeq++,
        step: "04",
        stepName: "DECISION",
        stage: "DECISION",
        kind: "decision",
        status: "completed",
        output: { decision: "release", actionsProposed: 0, reason: "All dimensional tolerances and surface quality verified." },
      },
    });

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "completed" },
    });

    return;
  }

  // Calculate sliding window distinct defects
  const windowMs = policy.slidingWindowMinutes * 60 * 1000;
  const captureTime = inspection.capturedAt ? inspection.capturedAt.getTime() : inspection.receivedAt.getTime();
  const windowStart = new Date(captureTime - windowMs);

  const windowInspections = await prisma.inspection.findMany({
    where: {
      batchId: batch.id,
      outcome: "defect",
      receivedAt: { gte: windowStart },
    },
    select: { itemId: true },
  });

  const distinctDefectiveItemIds = Array.from(
    new Set(windowInspections.map((i) => i.itemId).filter(Boolean))
  );
  const defectCountInWindow = distinctDefectiveItemIds.length;
  const thresholdBreached = defectCountInWindow >= policy.escalationDefectTrigger;

  // Define Agent Tools
  const tools: ToolDefinition[] = [
    {
      name: "get_inspection_context",
      description: "Returns the current inspection details, batch identifiers, and distinct in-window defect count",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_quality_policy",
      description: "Returns the enforced quality containment policy, thresholds, and allowed ERP action rules",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_supplier_history",
      description: "Retrieves audited historical quality incident records for the batch supplier",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "propose_quality_action",
      description: "Proposes an accountable quality action for supervisor authorization (CREATE_QUALITY_NOTIFICATION, HOLD_MATERIAL_LOT, HOLD_WORK_ORDER)",
      inputSchema: {
        type: "object",
        properties: {
          actionType: {
            type: "string",
            description: "Action type: CREATE_QUALITY_NOTIFICATION | HOLD_MATERIAL_LOT | HOLD_WORK_ORDER",
          },
          summary: { type: "string", description: "Concise factual reason for the action" },
          missingData: { type: "string", description: "Any missing data or fields" },
        },
        required: ["actionType", "summary"],
      },
    },
  ];

  const systemPrompt = `You are the SIGAP Smart Manufacturing Quality Containment Agent.
Your duty: Review verified optical defects for casting impellers, retrieve factual context, check deterministic policy thresholds, and propose governed ERP actions.
Rules:
1. Always call get_inspection_context and get_quality_policy first.
2. If defect count in window >= 3, propose both CREATE_QUALITY_NOTIFICATION and HOLD_MATERIAL_LOT.
3. If defect count is 1 or 2, propose CREATE_QUALITY_NOTIFICATION.
4. Never execute actions directly; all proposals require supervisor authorization.`;

  const messages: AgentTurnMessage[] = [
    {
      role: "user",
      content: `Please analyze the current defect on batch '${batch.lotId}' (item '${inspection.itemId}') and propose appropriate quality containment actions based on policy.`,
    },
  ];

  let currentSequence = 2;
  const proposedActionTypes: ActionType[] = [];

  // Model turns loop (maximum 5 turns)
  for (let turn = 0; turn < 5; turn++) {
    const turnResult = await adapter.nextTurn(messages, tools, systemPrompt);

    if (turnResult.toolCalls.length === 0) {
      // Model finished turn loop
      break;
    }

    // Assistant message with tool calls
    messages.push({
      role: "assistant",
      summary: turnResult.summary,
      toolCalls: turnResult.toolCalls,
    });

    const turnToolResults: Array<{ toolCallId: string; result: unknown }> = [];
    for (const toolCall of turnResult.toolCalls) {
      let resultData: unknown = {};
      const t0 = Date.now();

      if (toolCall.name === "get_inspection_context") {
        resultData = {
          inspectionId: inspection.id,
          batchId: batch.id,
          lotId: batch.lotId,
          itemId: inspection.itemId,
          outcome: inspection.outcome,
          confidence: inspection.confidence,
          materialNumber: batch.materialNumber,
          workOrderId: batch.workOrderId,
          supplierName: batch.supplierName,
          defectCountInWindow,
          distinctDefectiveItemIds,
        };

        await prisma.agentLog.create({
          data: {
            inspectionId: inspection.id,
            runId: run.id,
            sequence: currentSequence++,
            step: "02",
            stepName: "MEMORY",
            stage: "MEMORY",
            kind: "tool_result",
            status: "completed",
            input: { tool: "get_inspection_context" },
            output: JSON.parse(JSON.stringify(resultData)),
            latencyMs: Date.now() - t0,
          },
        });
      } else if (toolCall.name === "get_quality_policy") {
        resultData = {
          policyId: policy.policyId,
          slidingWindowMinutes: policy.slidingWindowMinutes,
          escalationDefectTrigger: policy.escalationDefectTrigger,
          allowedActions: policy.allowedActions.map((a) => a.actionType),
        };

        await prisma.agentLog.create({
          data: {
            inspectionId: inspection.id,
            runId: run.id,
            sequence: currentSequence++,
            step: "03",
            stepName: "FORMULA",
            stage: "FORMULA",
            kind: "tool_result",
            status: "completed",
            input: { tool: "get_quality_policy" },
            output: {
              defectCountInWindow,
              threshold: policy.escalationDefectTrigger,
              thresholdBreached,
            },
            latencyMs: Date.now() - t0,
          },
        });
      } else if (toolCall.name === "get_supplier_history") {
        const suppRecord = policy.supplierHistory[batch.supplierName || ""] || { status: "unknown" };
        resultData = { supplierName: batch.supplierName, history: suppRecord };
      } else if (toolCall.name === "propose_quality_action") {
        const actionType = toolCall.input.actionType as ActionType;
        const summary = (toolCall.input.summary as string) || "Quality containment action";

        // Validate action type against threshold
        let allowed = false;
        if (actionType === "CREATE_QUALITY_NOTIFICATION") allowed = defectCountInWindow >= 1;
        if (actionType === "HOLD_MATERIAL_LOT" || actionType === "HOLD_WORK_ORDER") {
          allowed = thresholdBreached;
        }

        if (allowed) {
          const actionKey = `${batch.id}:${batch.caseEpoch}:${actionType}`;
          const consumerMap: Record<ActionType, "SAP_QM" | "SAP_MM" | "SAP_PP"> = {
            CREATE_QUALITY_NOTIFICATION: "SAP_QM",
            HOLD_MATERIAL_LOT: "SAP_MM",
            HOLD_WORK_ORDER: "SAP_PP",
          };

          const targetId =
            actionType === "HOLD_WORK_ORDER"
              ? batch.workOrderId || "WO-2026-771"
              : batch.materialNumber || "MAT-IMP-9842";

          const payloadHash = crypto
            .createHash("sha256")
            .update(`${actionKey}:${targetId}`)
            .digest("hex");

          // Create or link DispatchRecord
          const dispatch = await prisma.dispatchRecord.upsert({
            where: { actionKey },
            update: {
              status: "pending_approval",
              runId: run.id,
            },
            create: {
              id: `DSP-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex")}`,
              batchId: batch.id,
              triggerReason: summary,
              consumer: consumerMap[actionType],
              payload: {
                actionKey,
                actionType,
                targetId,
                defectCountInWindow,
                summary,
              },
              status: "pending_approval",
              runId: run.id,
              caseEpoch: batch.caseEpoch,
              actionType,
              actionKey,
              payloadHash,
              expectedBatchVersion: batch.version,
            },
          });

          proposedActionTypes.push(actionType);
          resultData = {
            accepted: true,
            dispatchId: dispatch.id,
            actionKey,
            status: "pending_approval",
            requiresSupervisorApproval: true,
          };

          emitSigapEvent("dispatch:status_changed", dispatch);
        } else {
          resultData = {
            accepted: false,
            reason: `Action '${actionType}' does not satisfy threshold requirement (${defectCountInWindow}/${policy.escalationDefectTrigger} defects in window)`,
          };
        }

        await prisma.agentLog.create({
          data: {
            inspectionId: inspection.id,
            runId: run.id,
            sequence: currentSequence++,
            step: "04",
            stepName: "DECISION",
            stage: "DECISION",
            kind: "decision",
            status: allowed ? "completed" : "failed",
            input: JSON.parse(JSON.stringify(toolCall.input)),
            output: JSON.parse(JSON.stringify(resultData)),
            latencyMs: Date.now() - t0,
          },
        });
      }

      turnToolResults.push({
        toolCallId: toolCall.id,
        result: resultData,
      });
    }
    messages.push({
      role: "user",
      toolResults: turnToolResults,
    });
  }

  // Record DISPATCH stage in AgentLog
  await prisma.agentLog.create({
    data: {
      inspectionId: inspection.id,
      runId: run.id,
      sequence: currentSequence++,
      step: "05",
      stepName: "DISPATCH",
      stage: "DISPATCH",
      kind: "decision",
      status: proposedActionTypes.length > 0 ? "pending" : "completed",
      output: {
        actionsProposed: proposedActionTypes,
        status: proposedActionTypes.length > 0 ? "awaiting_supervisor_approval" : "none_required",
      },
    },
  });

  // Finalize WorkflowRun status
  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: proposedActionTypes.length > 0 ? "awaiting_approval" : "completed",
      provider: adapter.providerName,
      modelId: adapter.modelId,
    },
  });
}

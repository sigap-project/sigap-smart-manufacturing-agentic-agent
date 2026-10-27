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
import { Prisma } from "@prisma/client";

interface QualityPolicy {
  policyId: string;
  version: number;
  productFamily?: string;
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

export function computeActionPayloadHash(params: {
  actionKey: string;
  actionType: string;
  batchId: string;
  caseEpoch: number;
  targetId: string;
}): string {
  const canonical = {
    actionKey: params.actionKey,
    actionType: params.actionType,
    batchId: params.batchId,
    caseEpoch: params.caseEpoch,
    targetId: params.targetId,
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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
  const policy = ((run.policySnapshot as unknown) as QualityPolicy) || (await loadPolicy());
  const adapter = getAIAdapter();

  // Monotonic sequence starting point
  const lastLog = await prisma.agentLog.findFirst({
    where: { runId: run.id },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  let currentSequence = (lastLog?.sequence ?? 1) + 1;

  // 1. If inspection is OK, deterministic pass without calling external LLM
  if (inspection.outcome === "ok") {
    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: currentSequence++,
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
        sequence: currentSequence++,
        step: "03",
        stepName: "FORMULA",
        stage: "FORMULA",
        kind: "decision",
        status: "completed",
        output: {
          distinctDefectsInWindow: 0,
          threshold: policy.escalationDefectTrigger,
          thresholdBreached: false,
        },
      },
    });

    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: currentSequence++,
        step: "04",
        stepName: "DECISION",
        stage: "DECISION",
        kind: "decision",
        status: "completed",
        output: {
          decision: "release",
          actionsProposed: 0,
          reason: "Classifier passed this image; no surface casting defect detected.",
        },
      },
    });

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "completed" },
    });
    return;
  }

  // 2. If inspection is unknown, deterministic review path without ERP proposals
  if (inspection.outcome === "unknown") {
    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: currentSequence++,
        step: "02",
        stepName: "MEMORY",
        stage: "MEMORY",
        kind: "decision",
        status: "completed",
        output: {
          result:
            "Workpiece review required: optical confidence below threshold or unsupported input.",
        },
      },
    });

    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: currentSequence++,
        step: "03",
        stepName: "FORMULA",
        stage: "FORMULA",
        kind: "decision",
        status: "skipped",
        output: {
          distinctDefectsInWindow: 0,
          thresholdBreached: false,
          note: "Unknown outcomes use deterministic review path; ERP proposals blocked.",
        },
      },
    });

    await prisma.agentLog.create({
      data: {
        inspectionId: inspection.id,
        runId: run.id,
        sequence: currentSequence++,
        step: "04",
        stepName: "DECISION",
        stage: "DECISION",
        kind: "decision",
        status: "completed",
        output: {
          decision: "review_required",
          actionsProposed: 0,
          reason: inspection.errorCode || "low_confidence",
        },
      },
    });

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "needs_review" },
    });
    return;
  }

  // 3. Closed capture-time window calculation [capturedAt - 8 minutes, capturedAt]
  const captureDate = inspection.capturedAt || inspection.receivedAt;
  const windowMs = (policy.slidingWindowMinutes || 8) * 60 * 1000;
  const windowStart = new Date(captureDate.getTime() - windowMs);
  const windowEnd = captureDate;

  const windowInspections = await prisma.inspection.findMany({
    where: {
      batchId: batch.id,
      caseEpoch: batch.caseEpoch,
      capturedAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      itemId: true,
      outcome: true,
      reviewOutcome: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: "asc" },
  });

  const effectiveDefectItemIds = new Set<string>();
  for (const insp of windowInspections) {
    if (insp.reviewOutcome === "confirmed_defect") {
      if (insp.itemId) effectiveDefectItemIds.add(insp.itemId);
    } else if (insp.reviewOutcome === "confirmed_ok") {
      // Excluded
    } else {
      if (insp.outcome === "defect" && insp.itemId) {
        effectiveDefectItemIds.add(insp.itemId);
      }
    }
  }

  // Ensure current defect is counted
  if (
    inspection.outcome === "defect" &&
    inspection.reviewOutcome !== "confirmed_ok" &&
    inspection.itemId
  ) {
    effectiveDefectItemIds.add(inspection.itemId);
  }

  const distinctDefectiveItemIds = Array.from(effectiveDefectItemIds);
  const defectCountInWindow = distinctDefectiveItemIds.length;
  const thresholdBreached = defectCountInWindow >= (policy.escalationDefectTrigger || 3);

  // Check out-of-order requeue: if a late event affects a newer workflow in this case
  const newerWorkflows = await prisma.workflowRun.findMany({
    where: {
      batchId: batch.id,
      caseEpoch: batch.caseEpoch,
      id: { not: run.id },
      status: { in: ["completed", "needs_review"] },
      inspection: {
        capturedAt: {
          gt: captureDate,
          lte: new Date(captureDate.getTime() + windowMs),
        },
      },
    },
    include: { inspection: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (newerWorkflows.length > 0) {
    const newerRun = newerWorkflows[0];
    await prisma.workflowRun.update({
      where: { id: newerRun.id },
      data: { status: "queued", attempts: 0 },
    });
  }

  // Define Governed Agent Tools
  const tools: ToolDefinition[] = [
    {
      name: "get_inspection_context",
      description:
        "Returns the current inspection details, batch identifiers, and distinct in-window defect count",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_quality_policy",
      description:
        "Returns the enforced quality containment policy, thresholds, and allowed ERP action rules",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_supplier_history",
      description:
        "Retrieves audited historical quality incident records for the batch supplier (synthetic scenario data)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "propose_quality_action",
      description:
        "Proposes an accountable quality action for supervisor authorization (CREATE_QUALITY_NOTIFICATION, HOLD_MATERIAL_LOT, HOLD_WORK_ORDER)",
      inputSchema: {
        type: "object",
        properties: {
          actionType: {
            type: "string",
            enum: ["CREATE_QUALITY_NOTIFICATION", "HOLD_MATERIAL_LOT", "HOLD_WORK_ORDER"],
            description:
              "Action type: CREATE_QUALITY_NOTIFICATION | HOLD_MATERIAL_LOT | HOLD_WORK_ORDER",
          },
          summary: { type: "string", description: "Concise factual reason for the action" },
        },
        required: ["actionType", "summary"],
      },
    },
  ];

  const systemPrompt = `You are the SIGAP Smart Manufacturing Quality Containment Agent.
Your duty: Review verified optical casting defects, retrieve factual inspection context, verify deterministic policy thresholds, and propose governed ERP actions.
Rules:
1. Always call get_inspection_context and get_quality_policy first before proposing any action.
2. For 1 or 2 distinct defects in window, you may propose only CREATE_QUALITY_NOTIFICATION.
3. For 3 or more distinct defects in window, propose CREATE_QUALITY_NOTIFICATION, HOLD_MATERIAL_LOT, and HOLD_WORK_ORDER when respective targets exist.
4. Never execute actions directly; all proposals require supervisor authorization.`;

  const messages: AgentTurnMessage[] = [
    {
      role: "user",
      content: `Analyze the optical defect on batch '${batch.lotId}' (item '${inspection.itemId}') and propose appropriate quality actions based on policy.`,
    },
  ];

  let contextRetrieved = false;
  let policyRetrieved = false;
  let hasMissingTargetBlocked = false;
  const proposedActionTypes: ActionType[] = [];

  // Model turns loop (maximum 5 turns)
  for (let turn = 0; turn < 5; turn++) {
    let turnResult: {
      toolCalls: ToolCall[];
      summary?: string;
    };

    try {
      turnResult = await adapter.nextTurn(messages, tools, systemPrompt);
    } catch (adapterErr) {
      console.error(`[AGENT ADAPTER ERROR Turn ${turn + 1}]:`, adapterErr);
      await prisma.agentLog.create({
        data: {
          inspectionId: inspection.id,
          runId: run.id,
          sequence: currentSequence++,
          step: String(currentSequence).padStart(2, "0"),
          stepName: "DECISION",
          stage: "DECISION",
          kind: "error",
          status: "failed",
          input: { turn },
          output: {
            error: adapterErr instanceof Error ? adapterErr.message : "Provider invocation failed",
          },
          latencyMs: 0,
        },
      });

      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: "needs_review",
          lastError:
            adapterErr instanceof Error ? adapterErr.message : "Cloud AI Provider failed",
        },
      });
      return;
    }

    if (turnResult.toolCalls.length === 0) {
      // Model concluded turns loop
      break;
    }

    // Append Assistant Message with Tool Calls
    messages.push({
      role: "assistant",
      summary: turnResult.summary,
      toolCalls: turnResult.toolCalls,
    });

    const turnToolResults: Array<{ toolCallId: string; result: unknown; isError?: boolean }> = [];

    for (const toolCall of turnResult.toolCalls) {
      let resultData: Record<string, unknown> = {};
      let isError = false;
      let stageName = "MEMORY";
      const t0 = Date.now();

      if (toolCall.name === "get_inspection_context") {
        contextRetrieved = true;
        stageName = "MEMORY";
        resultData = {
          inspectionId: inspection.id,
          batchId: batch.id,
          lotId: batch.lotId,
          itemId: inspection.itemId,
          outcome: inspection.outcome,
          confidence: inspection.confidence,
          materialNumber: batch.materialNumber || null,
          workOrderId: batch.workOrderId || null,
          supplierName: batch.supplierName || null,
          defectCountInWindow,
          distinctDefectiveItemIds,
          windowMinutes: policy.slidingWindowMinutes,
        };
      } else if (toolCall.name === "get_quality_policy") {
        policyRetrieved = true;
        stageName = "FORMULA";
        const allowedActionsList = Array.isArray(policy.allowedActions)
          ? policy.allowedActions
              .map((a: any) => (typeof a === "string" ? a : a?.actionType))
              .filter(Boolean)
          : ["CREATE_QUALITY_NOTIFICATION", "HOLD_MATERIAL_LOT", "HOLD_WORK_ORDER"];
        resultData = {
          policyId: policy.policyId || "sigap-demo-quality-v1",
          version: policy.version ?? 1,
          slidingWindowMinutes: policy.slidingWindowMinutes ?? 8,
          escalationDefectTrigger: policy.escalationDefectTrigger ?? 3,
          allowedActions: allowedActionsList,
          thresholdBreached,
          defectCountInWindow,
        };
      } else if (toolCall.name === "get_supplier_history") {
        stageName = "MEMORY";
        const suppRecord =
          policy.supplierHistory && policy.supplierHistory[batch.supplierName || ""]
            ? {
                ...((policy.supplierHistory[batch.supplierName || ""] as unknown) as Record<
                  string,
                  unknown
                >),
                isSyntheticScenarioData: true,
              }
            : { status: "unknown", recordFound: false, isSyntheticScenarioData: true };
        resultData = {
          supplierName: batch.supplierName || "unknown",
          history: suppRecord,
        };
      } else if (toolCall.name === "propose_quality_action") {
        stageName = "DECISION";

        if (!contextRetrieved || !policyRetrieved) {
          isError = true;
          resultData = {
            accepted: false,
            error: "PREREQUISITE_FAILED",
            message:
              "get_inspection_context and get_quality_policy must be called before proposing actions",
          };
        } else {
          const actionType = toolCall.input.actionType as ActionType;
          const summary =
            (toolCall.input.summary as string) || "Governed quality containment action proposal";

          if (
            actionType !== "CREATE_QUALITY_NOTIFICATION" &&
            actionType !== "HOLD_MATERIAL_LOT" &&
            actionType !== "HOLD_WORK_ORDER"
          ) {
            isError = true;
            resultData = {
              accepted: false,
              error: "INVALID_ACTION_TYPE",
              message: `Action type '${actionType}' is not permitted by quality policy`,
            };
          } else {
            // Validate threshold
            let thresholdSatisfied = false;
            if (actionType === "CREATE_QUALITY_NOTIFICATION") {
              thresholdSatisfied = defectCountInWindow >= 1;
            } else if (
              actionType === "HOLD_MATERIAL_LOT" ||
              actionType === "HOLD_WORK_ORDER"
            ) {
              thresholdSatisfied = thresholdBreached;
            }

            if (!thresholdSatisfied) {
              isError = true;
              resultData = {
                accepted: false,
                error: "THRESHOLD_NOT_MET",
                message: `Action '${actionType}' requires threshold breach (${defectCountInWindow}/${policy.escalationDefectTrigger} defects)`,
              };
            } else {
              // Target ID check (No hardcoded fake fallbacks!)
              let targetId: string | null = null;
              if (actionType === "CREATE_QUALITY_NOTIFICATION") {
                targetId = batch.materialNumber || batch.lotId || batch.id;
              } else if (actionType === "HOLD_MATERIAL_LOT") {
                targetId = batch.materialNumber;
              } else if (actionType === "HOLD_WORK_ORDER") {
                targetId = batch.workOrderId;
              }
              if (!targetId || targetId.trim() === "") {
                isError = true;
                hasMissingTargetBlocked = true;
                resultData = {
                  accepted: false,
                  error: "MISSING_TARGET_ID",
                  message: `Missing target ID for ${actionType} on batch; action blocked and routed for supervisor review`,
                };
              } else {
                const actionKey = `${batch.id}:${batch.caseEpoch}:${actionType}`;
                const payloadHash = computeActionPayloadHash({
                  actionKey,
                  actionType,
                  batchId: batch.id,
                  caseEpoch: batch.caseEpoch,
                  targetId,
                });

                const consumerMap: Record<ActionType, "SAP_QM" | "SAP_MM" | "SAP_PP"> = {
                  CREATE_QUALITY_NOTIFICATION: "SAP_QM",
                  HOLD_MATERIAL_LOT: "SAP_MM",
                  HOLD_WORK_ORDER: "SAP_PP",
                };

                // Check existing action under actionKey
                const existingAction = await prisma.dispatchRecord.findUnique({
                  where: { actionKey },
                });

                if (existingAction) {
                  if (existingAction.payloadHash !== payloadHash) {
                    isError = true;
                    resultData = {
                      accepted: false,
                      actionKey,
                      error: "PAYLOAD_CONFLICT",
                      message:
                        "Existing action key has conflicting payload hash; requires review before approval",
                    };
                  } else {
                    // Do not reset existing queued/executing/verified/rejected status!
                    resultData = {
                      accepted: true,
                      dispatchId: existingAction.id,
                      actionKey,
                      status: existingAction.status,
                      alreadyExists: true,
                      requiresSupervisorApproval:
                        existingAction.status === "pending_approval",
                    };
                    proposedActionTypes.push(actionType);
                  }
                } else {
                  const dispatch = await prisma.dispatchRecord.create({
                    data: {
                      id: `DSP-${Date.now().toString().slice(-6)}-${crypto
                        .randomBytes(2)
                        .toString("hex")}`,
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
                }
              }
            }
          }
        }
      } else {
        // Unknown tool call
        isError = true;
        stageName = "DECISION";
        resultData = {
          accepted: false,
          error: "UNKNOWN_TOOL",
          message: `Tool '${toolCall.name}' is not recognized in SIGAP quality workflow`,
        };
      }

      // Record tool execution in AgentLog
      await prisma.agentLog.create({
        data: {
          inspectionId: inspection.id,
          runId: run.id,
          sequence: currentSequence++,
          toolCallId: toolCall.id,
          step: String(currentSequence).padStart(2, "0"),
          stepName: stageName,
          stage: stageName,
          kind: isError ? "error" : "tool_result",
          status: isError ? "failed" : "completed",
          input: toolCall.input as Prisma.InputJsonValue,
          output: JSON.parse(JSON.stringify(resultData)) as Prisma.InputJsonValue,
          latencyMs: Date.now() - t0,
        },
      });

      turnToolResults.push({
        toolCallId: toolCall.id,
        result: resultData,
        isError,
      });
    }

    // Append Tool Results to Messages
    messages.push({
      role: "user",
      toolResults: turnToolResults,
    });
  }

  // Determine final terminal status for this run
  let finalStatus = "completed";
  if (hasMissingTargetBlocked || !contextRetrieved) {
    finalStatus = "needs_review";
  } else if (proposedActionTypes.length > 0) {
    finalStatus = "awaiting_approval";
  }

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
    },
  });
}

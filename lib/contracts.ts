import type { InspectionRecord } from "@/components/history/types";

/**
 * SIGAP Shared Contracts & Wire Interfaces (Schema Version 1)
 * Defined in SIGAP_INTEGRATION_PLAN.md
 */

export interface InspectionEvent {
  schemaVersion: 1;
  eventId: string; // UUID generated once before persistence/retry
  deviceId: string | null;
  batchId: string; // exact database Batch.id, never display lotId
  bindingVersion: number;
  itemId: string; // operator-assigned identity within this batch
  capturedAt: string; // UTC ISO; backend also records receivedAt
  captureSource: "pi-webcam" | "pi-file-replay" | "browser-upload" | "browser-webcam";
  inferenceLocation: "pi" | "server";
  modelVersion: string; // versioned manifest hash
  inferenceMs: number;
  classificationMs: number;
  localizationMs: number | null;
  localizationStatus: "completed" | "skipped" | "failed";
  localAlertMs: number | null; // capture -> GPIO command; null if outputs disabled
  outcome: "ok" | "defect" | "unknown";
  probabilities: { ok: number; defect: number } | null; // [0,1]
  confidence: number | null; // winning class probability * 100
  frame: {
    jpegBase64: string;
    sha256: string;
    width: number;
    height: number;
  };
  coordinateSpace: "source-percent";
  boundingBoxes: {
    id: string;
    label: "defect";
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }[]; // top-left source image percentages; scores [0, 100]
  errorCode?: "model_unavailable" | "low_confidence" | "unsupported_input";
}

export interface IngestResult {
  eventId: string;
  inspectionId: string;
  runId: string;
  duplicate: boolean;
  batchVersion: number;
  caseEpoch: number;
  imageSha256: string;
  payloadHash?: string;
}

export type UserRole = "viewer" | "operator" | "supervisor";

export interface Actor {
  type: "device" | "user";
  id: string;
  role?: UserRole;
  deviceId?: string;
  batchId?: string;
}

export interface InspectionView {
  schemaVersion: 1;
  eventId: string;
  inspectionId: string;
  runId?: string;
  caseEpoch?: number;
  deviceId: string | null;
  batchId: string;
  lotId?: string;
  bindingVersion: number;
  itemId: string;
  capturedAt: string;
  receivedAt: string;
  captureSource: "pi-webcam" | "pi-file-replay" | "browser-upload" | "browser-webcam";
  inferenceLocation: "pi" | "server";
  modelVersion: string;
  inferenceMs: number;
  classificationMs: number;
  localizationMs: number | null;
  localizationStatus: "completed" | "skipped" | "failed";
  localAlertMs: number | null;
  outcome: "ok" | "defect" | "unknown";
  probabilities: { ok: number; defect: number } | null;
  confidence: number | null;
  coordinateSpace: "source-percent";
  boundingBoxes: {
    id: string;
    label: "defect";
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }[];
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  imageSha256: string;
  payloadHash?: string | null;
  evidenceStore?: "local" | "s3" | null;
  reviewOutcome?: "confirmed_ok" | "confirmed_defect" | "unresolved" | null;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  status?: string;
  errorCode?: string;
}

export interface BrowserInspectionRequest {
  eventId: string;
  batchId: string;
  itemId?: string; // omit to let the server assign "<lotId>-NNN"
  capturedAt: string;
  captureSource: "browser-upload" | "browser-webcam";
  jpegBase64: string;
}

export interface BrowserInspectionResult {
  inspection: InspectionRecord;
  runId: string;
  duplicate: boolean;
}

export type ActionType =
  | "CREATE_QUALITY_NOTIFICATION"
  | "HOLD_MATERIAL_LOT"
  | "HOLD_WORK_ORDER";

export type DispatchState =
  | "proposed"
  | "pending_approval"
  | "queued"
  | "executing"
  | "verifying"
  | "verified"
  | "rejected"
  | "failed";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

export interface AgentTurnMessage {
  role: "user" | "assistant" | "system";
  content?: string;
  summary?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  toolResult?: ToolResult;
}

export interface AIProviderAdapter {
  providerName: "bedrock" | "sap-ai-core";
  modelId: string;
  nextTurn(
    messages: AgentTurnMessage[],
    tools: ToolDefinition[],
    systemPrompt?: string
  ): Promise<{
    toolCalls: ToolCall[];
    summary?: string;
    usage?: TokenUsage;
  }>;
}

export interface DeviceHeartbeat {
  deviceId: string;
  queueDepth: number;
  blockedQueueDepth?: number;
  cameraHealthy: boolean;
  modelHealthy: boolean;
  modelVersion: string;
  idle: boolean;
  paused: boolean;
  lastEventId?: string;
  localAlert: boolean;
  hardwareMode?: "physical" | "simulated" | "fault";
  lastErrorCode?: string | null;
  timestamp: string;
}

export interface DeviceStatusResponse {
  batchId: string;
  bindingVersion: number;
  stateVersion: number;
  batchVersion: number;
  caseEpoch: number;
  batchStatus: string;
  latestInspectionId?: string;
  validForMs: number;
}

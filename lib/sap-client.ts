import { ActionType } from "./contracts";
import { prisma } from "./prisma";

export type SapConsumer = "SAP_QM" | "SAP_MM" | "SAP_PP";

export interface SapDispatchPayload {
  actionKey: string;
  actionType: ActionType;
  consumer: SapConsumer;
  targetId: string;
  payloadHash: string;
  batchId: string;
  details: Record<string, unknown>;
}

export type SapDispatchResult =
  | {
      ok: true;
      externalId: string;
      mode: "simulator";
      resultingState: "OPEN" | "QUALITY_HOLD" | "HELD";
      response: Record<string, unknown>;
    }
  | {
      ok: false;
      code: string;
      error: string;
      retryable: boolean;
    };

function getEndpointForAction(actionType: ActionType): string {
  switch (actionType) {
    case "CREATE_QUALITY_NOTIFICATION":
      return "/api/mock/sap/qm";
    case "HOLD_MATERIAL_LOT":
      return "/api/mock/sap/mm";
    case "HOLD_WORK_ORDER":
      return "/api/mock/sap/pp";
  }
}

async function executeSimulatorInProcess(payload: SapDispatchPayload): Promise<SapDispatchResult> {
  const { actionKey, actionType, payloadHash, targetId } = payload;
  const existing = await prisma.simulatorRecord.findUnique({ where: { actionKey } });

  if (existing) {
    if (existing.payloadHash === payloadHash) {
      return {
        ok: true,
        externalId: existing.externalId,
        mode: "simulator",
        resultingState: existing.resultingState as "OPEN" | "QUALITY_HOLD" | "HELD",
        response: {
          externalId: existing.externalId,
          resultingState: existing.resultingState,
          actionKey: existing.actionKey,
        },
      };
    }
    return {
      ok: false,
      code: "PAYLOAD_HASH_CONFLICT",
      error: "Action key already executed with conflicting payload hash",
      retryable: false,
    };
  }

  const prefixMap: Record<ActionType, string> = {
    CREATE_QUALITY_NOTIFICATION: "QM-NOTIF",
    HOLD_MATERIAL_LOT: "MM-HOLD",
    HOLD_WORK_ORDER: "PP-WO",
  };
  const stateMap: Record<ActionType, "OPEN" | "QUALITY_HOLD" | "HELD"> = {
    CREATE_QUALITY_NOTIFICATION: "OPEN",
    HOLD_MATERIAL_LOT: "QUALITY_HOLD",
    HOLD_WORK_ORDER: "HELD",
  };

  const externalId = `${prefixMap[actionType]}-${payloadHash.slice(0, 8).toUpperCase()}`;
  const resultingState = stateMap[actionType];

  const record = await prisma.simulatorRecord.create({
    data: {
      actionKey,
      payloadHash,
      targetId: String(targetId),
      externalId,
      actionType,
      resultingState,
    },
  });

  return {
    ok: true,
    externalId: record.externalId,
    mode: "simulator",
    resultingState: record.resultingState as "OPEN" | "QUALITY_HOLD" | "HELD",
    response: {
      externalId: record.externalId,
      resultingState: record.resultingState,
      actionKey: record.actionKey,
    },
  };
}

export async function dispatchToSap(payload: SapDispatchPayload): Promise<SapDispatchResult> {
  const baseUrl = process.env.SAP_ODATA_BASE_URL || "http://localhost:3000";
  const path = getEndpointForAction(payload.actionType);
  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sigap-simulator": "true",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        code: "PAYLOAD_HASH_CONFLICT",
        error: err.error || "Action key already executed with conflicting payload hash",
        retryable: false,
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        code: `HTTP_${res.status}`,
        error: `Simulator error ${res.status}: ${errText.slice(0, 100)}`,
        retryable: res.status >= 500,
      };
    }

    const data = await res.json();
    return {
      ok: true,
      externalId: data.externalId,
      mode: "simulator",
      resultingState: data.resultingState,
      response: data,
    };
  } catch (error) {
    // If standalone worker or test without HTTP server running, persist directly in DB SimulatorRecord
    if (baseUrl.includes("localhost:3000")) {
      return executeSimulatorInProcess(payload);
    }
    return {
      ok: false,
      code: "NETWORK_ERROR",
      error: error instanceof Error ? error.message : "Network failure connecting to SAP simulator",
      retryable: true,
    };
  }
}

export async function readBackFromSap(
  actionKey: string,
  actionType: ActionType
): Promise<{ ok: boolean; externalId?: string; resultingState?: string; error?: string }> {
  const baseUrl = process.env.SAP_ODATA_BASE_URL || "http://localhost:3000";
  const path = getEndpointForAction(actionType);
  const url = `${baseUrl.replace(/\/+$/, "")}${path}?actionKey=${encodeURIComponent(actionKey)}`;

  try {
    const res = await fetch(url, {
      headers: { "x-sigap-simulator": "true" },
    });

    if (res.status === 404) {
      return { ok: false, error: "Record not found in simulator" };
    }

    if (!res.ok) {
      return { ok: false, error: `Simulator read-back error: ${res.status}` };
    }

    const data = await res.json();
    return {
      ok: true,
      externalId: data.externalId,
      resultingState: data.resultingState,
    };
  } catch (err) {
    // Direct DB read-back fallback for standalone worker
    if (baseUrl.includes("localhost:3000")) {
      const record = await prisma.simulatorRecord.findUnique({ where: { actionKey } });
      if (record) {
        return {
          ok: true,
          externalId: record.externalId,
          resultingState: record.resultingState,
        };
      }
      return { ok: false, error: "Record not found in simulator" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Read-back network error",
    };
  }
}

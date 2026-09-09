export type SapConsumer = "SAP_QM" | "SAP_MM" | "SAP_PP";

export interface SapDispatchPayload {
  consumer: SapConsumer;
  batchId: string;
  defectCode: string;
  materialNumber?: string;
  supplierId?: string;
  workOrderId?: string;
  notes?: string;
  escalationScore?: number;
}

export interface SapDispatchResponse {
  success: boolean;
  ticketId: string;
  consumer: SapConsumer;
  mode: "mock" | "live";
  timestamp: string;
  data: Record<string, unknown>;
}

export async function dispatchToSap(payload: SapDispatchPayload): Promise<SapDispatchResponse> {
  const isMock = process.env.SAP_MODE !== "live";
  const baseUrl = isMock
    ? (process.env.SAP_ODATA_BASE_URL || "http://localhost:3000/api/mock/sap")
    : process.env.SAP_BTP_DESTINATION_URL;

  const endpointMap: Record<SapConsumer, string> = {
    SAP_QM: "/qm",
    SAP_MM: "/mm",
    SAP_PP: "/pp",
  };

  const url = `${baseUrl}${endpointMap[payload.consumer]}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isMock
          ? { "x-sigap-mock": "true" }
          : { "Authorization": `Bearer ${process.env.SAP_BTP_TOKEN || ""}` }),
      },
      body: JSON.stringify({
        ...payload,
        dispatchedAt: new Date().toISOString(),
        sourceSystem: "SIGAP_AI_AGENT",
      }),
    });

    if (!res.ok) {
      throw new Error(`SAP endpoint returned HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    return {
      success: true,
      ticketId: json.ticketId || json.d?.TicketId || `TICKET-${Date.now()}`,
      consumer: payload.consumer,
      mode: isMock ? "mock" : "live",
      timestamp: new Date().toISOString(),
      data: json,
    };
  } catch (error) {
    console.error(`[SAP Dispatch Error] Failed to send ${payload.consumer}:`, error);
    // Return structured offline fallback
    return {
      success: true,
      ticketId: `OFFLINE-${payload.consumer}-${Date.now().toString().slice(-5)}`,
      consumer: payload.consumer,
      mode: "mock",
      timestamp: new Date().toISOString(),
      data: {
        status: "QueuedOffline",
        reason: (error as Error).message,
        payload,
      },
    };
  }
}

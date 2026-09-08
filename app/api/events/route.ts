import { NextRequest } from "next/server";
import {
  addSigapListener,
  removeSigapListener,
  SigapEvent,
} from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/events
 * Endpoint Server-Sent Events (SSE) untuk streaming real-time event operasional SIGAP:
 * - inspection:created
 * - agent:log
 * - batch:status_changed
 * - dispatch:status_changed
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  let isCleanedUp = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let eventListener: ((event: SigapEvent) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: any, id?: string) => {
        if (isCleanedUp) return;
        try {
          const idLine = id ? `id: ${id}\n` : `id: ${Date.now()}\n`;
          const eventLine = `event: ${event}\n`;
          const dataLine = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(`${idLine}${eventLine}${dataLine}`));
        } catch (err) {
          cleanup();
        }
      };

      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;

        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        if (eventListener) {
          removeSigapListener(eventListener);
          eventListener = null;
        }

        try {
          controller.close();
        } catch {
          // Abaikan jika controller sudah tertutup
        }
      };

      // 1. Kirim event handshake pertama saat klien tersambung
      sendEvent("connected", {
        message: "SIGAP Real-Time Telemetry Stream Connected",
        connectedAt: new Date().toISOString(),
      });

      // 2. Pasang event listener ke core EventEmitter singleton
      eventListener = (event: SigapEvent) => {
        sendEvent(event.type, event.data, event.id);
      };
      addSigapListener(eventListener);

      // 3. Heartbeat interval untuk menjaga koneksi tetap aktif di belakang reverse proxy/load balancer
      heartbeatTimer = setInterval(() => {
        if (isCleanedUp) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 20000);

      // 4. Deteksi pembatalan/penutupan koneksi dari sisi klien (abort signal)
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (eventListener) removeSigapListener(eventListener);
      isCleanedUp = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

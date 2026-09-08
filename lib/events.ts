import { EventEmitter } from "events";

export type SigapEventType =
  | "inspection:created"
  | "agent:log"
  | "batch:status_changed"
  | "dispatch:status_changed"
  | "heartbeat";

export interface SigapEvent<T = any> {
  id: string;
  type: SigapEventType;
  data: T;
  timestamp: string;
}

// Gunakan singleton pattern pada globalThis agar instance EventEmitter
// tetap persisten dan digunakan bersama di seluruh Route Handler Next.js
const globalForEvents = globalThis as unknown as {
  sigapEventEmitter: EventEmitter | undefined;
};

export const sigapEventEmitter: EventEmitter =
  globalForEvents.sigapEventEmitter ?? new EventEmitter();

// Konfigurasi batas maksimal listener agar tidak ada limit warning saat banyak klien tersambung
sigapEventEmitter.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.sigapEventEmitter = sigapEventEmitter;
}

/**
 * Memancarkan event operasional ke seluruh subscriber SSE
 */
export function emitSigapEvent<T = any>(
  type: SigapEventType,
  data: T
): SigapEvent<T> {
  const event: SigapEvent<T> = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  sigapEventEmitter.emit("sigap_event", event);
  sigapEventEmitter.emit(type, event);

  return event;
}

/**
 * Mendaftarkan listener untuk seluruh event SIGAP
 */
export function addSigapListener(listener: (event: SigapEvent) => void) {
  sigapEventEmitter.on("sigap_event", listener);
}

/**
 * Menghapus listener SIGAP
 */
export function removeSigapListener(listener: (event: SigapEvent) => void) {
  sigapEventEmitter.off("sigap_event", listener);
}

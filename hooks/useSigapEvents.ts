"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SigapEvent, SigapEventType } from "@/lib/events";

export interface UseSigapEventsOptions {
  onInspectionCreated?: (data: any) => void;
  onAgentLog?: (data: any) => void;
  onBatchStatusChanged?: (data: any) => void;
  onDispatchStatusChanged?: (data: any) => void;
  onEvent?: (event: SigapEvent) => void;
  enabled?: boolean;
}

export function useSigapEvents(options: UseSigapEventsOptions = {}) {
  const {
    onInspectionCreated,
    onAgentLog,
    onBatchStatusChanged,
    onDispatchStatusChanged,
    onEvent,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SigapEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simpan callback ke ref agar tidak memicu reconnect EventSource setiap re-render
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    function connect() {
      if (!isSubscribed) return;

      try {
        eventSource = new EventSource("/api/events");

        eventSource.onopen = () => {
          if (!isSubscribed) return;
          setIsConnected(true);
          setError(null);
        };

        eventSource.onerror = (e) => {
          if (!isSubscribed) return;
          setIsConnected(false);
          setError("Koneksi event stream terputus. Mencoba reconnect otomatis...");
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconnect otomatis setelah 3 detik
          if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              connect();
            }, 3000);
          }
        };

        // 1. Tangani event connection handshake
        eventSource.addEventListener("connected", (e: MessageEvent) => {
          if (!isSubscribed) return;
          setIsConnected(true);
          setError(null);
        });

        // 2. Handler terpadu untuk setiap tipe event
        const handleEvent = (eventType: SigapEventType) => (e: MessageEvent) => {
          if (!isSubscribed) return;
          try {
            const parsedData = JSON.parse(e.data);
            const sigapEvt: SigapEvent = {
              id: e.lastEventId || `evt-${Date.now()}`,
              type: eventType,
              data: parsedData,
              timestamp: new Date().toISOString(),
            };

            setLastEvent(sigapEvt);

            // Jalankan callback umum
            callbacksRef.current.onEvent?.(sigapEvt);

            // Jalankan callback spesifik
            if (eventType === "inspection:created") {
              callbacksRef.current.onInspectionCreated?.(parsedData);
            } else if (eventType === "agent:log") {
              callbacksRef.current.onAgentLog?.(parsedData);
            } else if (eventType === "batch:status_changed") {
              callbacksRef.current.onBatchStatusChanged?.(parsedData);
            } else if (eventType === "dispatch:status_changed") {
              callbacksRef.current.onDispatchStatusChanged?.(parsedData);
            }
          } catch (err) {
            console.warn(`[useSigapEvents] Gagal parse payload untuk ${eventType}:`, err);
          }
        };

        eventSource.addEventListener("inspection:created", handleEvent("inspection:created"));
        eventSource.addEventListener("agent:log", handleEvent("agent:log"));
        eventSource.addEventListener("batch:status_changed", handleEvent("batch:status_changed"));
        eventSource.addEventListener("dispatch:status_changed", handleEvent("dispatch:status_changed"));
      } catch (err) {
        if (!isSubscribed) return;
        setIsConnected(false);
        setError(err instanceof Error ? err.message : "Gagal inisialisasi SSE");
        reconnectTimeout = setTimeout(connect, 4000);
      }
    }

    connect();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setIsConnected(false);
    };
  }, [enabled]);

  return {
    isConnected,
    lastEvent,
    error,
  };
}

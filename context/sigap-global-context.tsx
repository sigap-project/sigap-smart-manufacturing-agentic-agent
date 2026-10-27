"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { InspectionRecord } from "@/components/history/types";
import { BatchItem } from "@/components/batches/types";
import { DispatchItem } from "@/components/dispatch/types";
import { DEFAULT_SETTINGS, SettingsState } from "@/components/settings/types";
import { NotificationItem } from "@/components/dashboard/notification-popover";
import { useSigapEvents } from "@/hooks/useSigapEvents";

export type SystemStateType = "idle" | "scanning" | "ok" | "defect";

export interface GlobalStats {
  totalInspections: number;
  passedUnits: number;
  defectUnits: number;
  defectRate: number; // in percentage e.g. 3.2
  batchesHeldCount: number;
  activeLot: string;
  activePart: string;
  escalationScore: number;
}

export interface IngestInspectionPayload {
  id?: string;
  defectDetected: boolean;
  defectClass?: string;
  confidence?: number;
  severity?: "Critical" | "High" | "Medium" | "Low" | "None";
  escalationScore?: number;
  lotId?: string;
  batchId?: string;
  partName?: string;
  supplier?: string;
  line?: string;
  imageUrl?: string;
  boundingBoxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence: number;
  }>;
  reasoningSteps?: Array<{
    step: string;
    phase: string;
    title?: string;
    detail: string;
    latency?: string;
  }>;
  sapDispatches?: Array<{
    consumer: string;
    ticketId: string;
    mode: string;
  }>;
}

interface SigapGlobalContextType {
  inspections: InspectionRecord[];
  batches: BatchItem[];
  dispatches: DispatchItem[];
  notifications: NotificationItem[];
  settings: SettingsState;
  stats: GlobalStats;
  systemState: SystemStateType;
  unreadCount: number;
  setSystemState: (state: SystemStateType, durationMs?: number) => void;
  applyInspectionSnapshot: (record: IngestInspectionPayload | InspectionRecord) => void;
  ingestInspection: (payload: IngestInspectionPayload) => void;
  approveBatch: (batchId: string) => Promise<boolean>;
  rejectBatch: (batchId: string) => Promise<boolean>;
  createDispatch: (item: DispatchItem) => Promise<void>;
  saveSettings: (newSettings: SettingsState) => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  refreshServerState: () => Promise<void>;
}

const SigapGlobalContext = createContext<SigapGlobalContextType | undefined>(undefined);

export function SigapGlobalProvider({ children }: { children: React.ReactNode }) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [systemState, setSystemStateInternal] = useState<SystemStateType>("idle");
  const [stats, setStats] = useState<GlobalStats>({
    totalInspections: 0,
    passedUnits: 0,
    defectUnits: 0,
    defectRate: 0.0,
    batchesHeldCount: 0,
    activeLot: "N/A",
    activePart: "Submersible Pump Impeller Casting",
    escalationScore: 0.0,
  });

  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedEventsRef = useRef(new Set<string>());

  const triggerSystemState = useCallback(
    (state: SystemStateType, durationMs: number = 7000) => {
      if (stateTimeoutRef.current) {
        clearTimeout(stateTimeoutRef.current);
        stateTimeoutRef.current = null;
      }

      setSystemStateInternal(state);

      if (state !== "idle") {
        stateTimeoutRef.current = setTimeout(() => {
          setSystemStateInternal("idle");
          stateTimeoutRef.current = null;
        }, durationMs);
      }
    },
    []
  );

  // Authoritative server hydration
  const refreshServerState = useCallback(async () => {
    try {
      const [batchesRes, inspectionsRes, dispatchesRes, statsRes, settingsRes] =
        await Promise.allSettled([
          fetch("/api/batches").then((r) => r.json()),
          fetch("/api/inspections?limit=20").then((r) => r.json()),
          fetch("/api/dispatch?limit=20").then((r) => r.json()),
          fetch("/api/dashboard/stats").then((r) => r.json()),
          fetch("/api/settings").then((r) => r.json()),
        ]);

      if (batchesRes.status === "fulfilled" && batchesRes.value.success) {
        setBatches(batchesRes.value.data || []);
      }
      if (inspectionsRes.status === "fulfilled" && inspectionsRes.value.success) {
        setInspections(inspectionsRes.value.data || []);
      }
      if (dispatchesRes.status === "fulfilled" && dispatchesRes.value.success) {
        setDispatches(dispatchesRes.value.data || []);
      }
      if (settingsRes.status === "fulfilled" && settingsRes.value.success) {
        setSettings(settingsRes.value.data || DEFAULT_SETTINGS);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.success) {
        const s = statsRes.value.data;
        const total = s.totalInspections || 0;
        const defects = s.defectCount || 0;
        setStats({
          totalInspections: total,
          passedUnits: Math.max(0, total - defects),
          defectUnits: defects,
          defectRate: s.defectRate || 0.0,
          batchesHeldCount: s.batchesHeldCount || 0,
          activeLot: s.activeLotId || "N/A",
          activePart: "Submersible Pump Impeller Casting",
          escalationScore: typeof s.escalationScore === "number" ? s.escalationScore : 0.0,
        });
      }
    } catch (err) {
      console.warn("[SigapGlobal] Server state sync error:", err);
    }
  }, []);

  // Initial server state hydration on mount
  useEffect(() => {
    refreshServerState();
    const interval = setInterval(refreshServerState, 5000);
    return () => clearInterval(interval);
  }, [refreshServerState]);

  // Apply inspection snapshot from server or verified edge
  const applyInspectionSnapshot = useCallback(
    (payload: IngestInspectionPayload | InspectionRecord) => {
      const eventKey = ("eventId" in payload && payload.eventId) || payload.id || `INS-${Date.now()}`;
      if (processedEventsRef.current.has(eventKey)) {
        refreshServerState();
        return;
      }
      processedEventsRef.current.add(eventKey);

      const outcome = ("outcome" in payload && payload.outcome)
        ? payload.outcome
        : ("defectDetected" in payload && payload.defectDetected)
        ? "defect"
        : (payload.defectClass && payload.defectClass.toLowerCase() === "defect" ? "defect" : "ok");

      if (outcome === "defect") {
        triggerSystemState("defect", 7000);
      } else if (outcome === "ok") {
        triggerSystemState("ok", 5000);
      } else {
        triggerSystemState("idle", 5000);
      }

      refreshServerState();

      if (outcome === "defect") {
        const notifId = `notif-${eventKey}`;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notifId)) return prev;
          const newNotif: NotificationItem = {
            id: notifId,
            title: `Cacat Terdeteksi: ${payload.defectClass || "defect"}`,
            message: `Anomali mutu terverifikasi pada ${payload.batchId || "batch"}. Tinjauan supervisor diantrikan.`,
            timestamp: "Baru saja",
            type: "quarantine",
            read: false,
            href: "/dashboard/inspection",
            lotId: payload.batchId,
          };
          return [newNotif, ...prev];
        });
      }
    },
    [triggerSystemState, refreshServerState]
  );

  const approveBatch = useCallback(
    async (batchId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/approve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          await refreshServerState();
          return true;
        } else {
          const err = await res.json().catch(() => ({}));
          console.error(`[SigapGlobal] Approve batch failed (${res.status}):`, err.error);
          return false;
        }
      } catch (err) {
        console.error("[SigapGlobal] Approve batch network error:", err);
        return false;
      }
    },
    [refreshServerState]
  );

  const rejectBatch = useCallback(
    async (batchId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/reject`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          await refreshServerState();
          return true;
        } else {
          const err = await res.json().catch(() => ({}));
          console.error(`[SigapGlobal] Reject batch failed (${res.status}):`, err.error);
          return false;
        }
      } catch (err) {
        console.error("[SigapGlobal] Reject batch network error:", err);
        return false;
      }
    },
    [refreshServerState]
  );

  const createDispatch = useCallback(
    async (item: DispatchItem): Promise<void> => {
      try {
        await fetch("/api/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        await refreshServerState();
      } catch (err) {
        console.error("[SigapGlobal] Create dispatch error:", err);
      }
    },
    [refreshServerState]
  );

  const saveSettings = useCallback(
    async (newSettings: SettingsState): Promise<void> => {
      setSettings(newSettings);
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSettings),
        });
      } catch (err) {
        console.error("[SigapGlobal] Save settings error:", err);
      }
    },
    []
  );

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Sync with Server-Sent Events (SSE)
  useSigapEvents({
    onInspectionCreated: (newIns) => {
      applyInspectionSnapshot(newIns);
    },
    onAgentLog: (data) => {
      const phase = (data?.phase || data?.stepName || "").toUpperCase();
      if (phase === "DETECT" || phase === "SCAN" || phase === "INSPECT") {
        triggerSystemState("scanning", 3500);
      }
    },
    onBatchStatusChanged: () => {
      refreshServerState();
    },
    onDispatchStatusChanged: () => {
      refreshServerState();
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const contextValue = useMemo(
    () => ({
      inspections,
      batches,
      dispatches,
      notifications,
      settings,
      stats,
      systemState,
      unreadCount,
      setSystemState: triggerSystemState,
      applyInspectionSnapshot,
      ingestInspection: applyInspectionSnapshot,
      approveBatch,
      rejectBatch,
      createDispatch,
      saveSettings,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      refreshServerState,
    }),
    [
      inspections,
      batches,
      dispatches,
      notifications,
      settings,
      stats,
      systemState,
      unreadCount,
      triggerSystemState,
      applyInspectionSnapshot,
      approveBatch,
      rejectBatch,
      createDispatch,
      saveSettings,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      refreshServerState,
    ]
  );

  return (
    <SigapGlobalContext.Provider value={contextValue}>
      {children}
    </SigapGlobalContext.Provider>
  );
}

export function useSigapGlobal() {
  const context = useContext(SigapGlobalContext);
  if (!context) {
    throw new Error("useSigapGlobal must be used within a SigapGlobalProvider");
  }
  return context;
}

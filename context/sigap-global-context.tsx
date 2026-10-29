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

export interface BatchDecision {
  version: number;
  reason: string;
  csrfToken: string | null;
}

export interface MutationResult {
  ok: boolean;
  status?: number;
  message?: string;
  code?: string;
  error?: string;
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
  approveBatch: (batchId: string, decision: BatchDecision) => Promise<MutationResult>;
  rejectBatch: (batchId: string, decision: BatchDecision) => Promise<MutationResult>;
  reviewInspection: (
    inspectionId: string,
    reviewOutcome: "confirmed_ok" | "confirmed_defect",
    decision: BatchDecision
  ) => Promise<MutationResult>;
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

  // Authoritative server hydration, split by how fast each slice changes.
  // Every request is a database query on a small shared RDS, so polling stays lean.
  const refreshLive = useCallback(async () => {
    const [batchesRes, inspectionsRes] = await Promise.allSettled([
      fetch("/api/batches").then((r) => r.json()),
      fetch("/api/inspections?limit=20").then((r) => r.json()),
    ]);
    if (batchesRes.status === "fulfilled" && batchesRes.value.success) {
      setBatches(batchesRes.value.data || []);
    }
    if (inspectionsRes.status === "fulfilled" && inspectionsRes.value.success) {
      setInspections(inspectionsRes.value.data || []);
    }
  }, []);

  const refreshSlow = useCallback(async () => {
    const [dispatchesRes, statsRes, settingsRes] = await Promise.allSettled([
      fetch("/api/dispatch?limit=20").then((r) => r.json()),
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
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
  }, []);

  // Full refresh after mutations and events
  const refreshServerState = useCallback(async () => {
    try {
      await Promise.all([refreshLive(), refreshSlow()]);
    } catch (err) {
      console.warn("[SigapGlobal] Server state sync error:", err);
    }
  }, [refreshLive, refreshSlow]);

  // Hydrate on mount, then poll only while the tab is visible and the last poll has finished
  useEffect(() => {
    refreshServerState();

    // One in-flight flag per job, so a slow request never stacks up behind itself
    const makeTick = (job: () => Promise<void>) => {
      let busy = false;
      return async () => {
        if (busy || document.visibilityState !== "visible") return;
        busy = true;
        try {
          await job();
        } catch (err) {
          console.warn("[SigapGlobal] Poll error:", err);
        } finally {
          busy = false;
        }
      };
    };
    const tickLive = makeTick(refreshLive);
    const live = setInterval(tickLive, 10_000);
    const slow = setInterval(makeTick(refreshSlow), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tickLive();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(live);
      clearInterval(slow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshServerState, refreshLive, refreshSlow]);

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

  // Governed supervisor mutation: session cookie + CSRF + optimistic batch version.
  // Always refreshes so the next attempt carries the current version.
  const governedPatch = useCallback(
    async (url: string, body: Record<string, unknown>, csrfToken: string | null): Promise<MutationResult> => {
      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        await refreshServerState();
        if (res.ok && json.success) return { ok: true, message: json.message };
        return {
          ok: false,
          status: res.status,
          code: json.code,
          error: json.error || `Request failed (${res.status})`,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [refreshServerState]
  );

  const approveBatch = useCallback(
    (batchId: string, { version, reason, csrfToken }: BatchDecision) =>
      governedPatch(
        `/api/batches/${encodeURIComponent(batchId)}/approve`,
        { expectedBatchVersion: version, reason },
        csrfToken
      ),
    [governedPatch]
  );

  const rejectBatch = useCallback(
    (batchId: string, { version, reason, csrfToken }: BatchDecision) =>
      governedPatch(
        `/api/batches/${encodeURIComponent(batchId)}/reject`,
        { expectedBatchVersion: version, reason },
        csrfToken
      ),
    [governedPatch]
  );

  const reviewInspection = useCallback(
    (
      inspectionId: string,
      reviewOutcome: "confirmed_ok" | "confirmed_defect",
      { version, reason, csrfToken }: BatchDecision
    ) =>
      governedPatch(
        `/api/inspections/${encodeURIComponent(inspectionId)}/review`,
        { reviewOutcome, reason, expectedBatchVersion: version },
        csrfToken
      ),
    [governedPatch]
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
      reviewInspection,
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
      reviewInspection,
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

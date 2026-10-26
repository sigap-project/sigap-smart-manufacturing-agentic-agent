"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { INITIAL_INSPECTIONS, InspectionRecord } from "@/components/history/types";
import { INITIAL_BATCHES, BatchItem } from "@/components/batches/types";
import { INITIAL_DISPATCHES, DispatchItem } from "@/components/dispatch/types";
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

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Eskalasi Level 3 Otomatis",
    message: "Pola anomali cacat berulang terdeteksi pada Lot #B-2026-0730. Tiket QM-2026-9912 otomatis dikirim ke SAP QM.",
    timestamp: "3 mnt lalu",
    type: "escalation",
    read: false,
    href: "/dashboard/inspection",
    lotId: "#B-2026-0730",
  },
  {
    id: "notif-2",
    title: "Isolasi Zona Karantina",
    message: "Lot #B-2026-0726 (Exhaust Manifold K3) dialihkan ke Zona Karantina karena skor eskalasi melampaui 0.70.",
    timestamp: "18 mnt lalu",
    type: "quarantine",
    read: false,
    href: "/dashboard/batches",
    lotId: "#B-2026-0726",
  },
  {
    id: "notif-3",
    title: "Flag Vendor SAP MM UnderReview",
    message: "Supplier PT Krakatau Scrap Ind. diberi penandaan evaluasi kualitas otomatis pada Purchase Order aktif.",
    timestamp: "42 mnt lalu",
    type: "sap",
    read: false,
    href: "/dashboard/dispatch",
  },
  {
    id: "notif-4",
    title: "Pelepasan Batch Disetujui",
    message: "Supervisor menyetujui pelepasan Lot #B-2026-0729 untuk perakitan komponen lini utama.",
    timestamp: "1 jam lalu",
    type: "approval",
    read: true,
    href: "/dashboard/batches",
    lotId: "#B-2026-0729",
  },
];

interface SigapGlobalContextType {
  // State Collections
  inspections: InspectionRecord[];
  batches: BatchItem[];
  dispatches: DispatchItem[];
  notifications: NotificationItem[];
  settings: SettingsState;
  stats: GlobalStats;
  systemState: SystemStateType;
  unreadCount: number;

  // Actions for UI & AI Engineer Handoff
  setSystemState: (state: SystemStateType) => void;
  ingestInspection: (payload: IngestInspectionPayload) => void;
  approveBatch: (batchId: string) => void;
  rejectBatch: (batchId: string) => void;
  createDispatch: (item: DispatchItem) => void;
  saveSettings: (newSettings: SettingsState) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

const SigapGlobalContext = createContext<SigapGlobalContextType | undefined>(undefined);

export function SigapGlobalProvider({ children }: { children: React.ReactNode }) {
  const [inspections, setInspections] = useState<InspectionRecord[]>(INITIAL_INSPECTIONS);
  const [batches, setBatches] = useState<BatchItem[]>(INITIAL_BATCHES);
  const [dispatches, setDispatches] = useState<DispatchItem[]>(INITIAL_DISPATCHES);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [systemState, setSystemState] = useState<SystemStateType>("idle");

  const [stats, setStats] = useState<GlobalStats>({
    totalInspections: 1428,
    passedUnits: 1382,
    defectUnits: 46,
    defectRate: 3.2,
    batchesHeldCount: 4,
    activeLot: "#B-2026-0730",
    activePart: "Bracket Motor A7",
    escalationScore: 0.74,
  });

  const stateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved settings from localStorage if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sigap_system_settings");
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Helper to transition 3D Twin state with auto return to idle
  const triggerSystemState = useCallback((nextState: SystemStateType, returnToIdleMs = 6000) => {
    setSystemState(nextState);
    if (stateTimerRef.current) {
      clearTimeout(stateTimerRef.current);
      stateTimerRef.current = null;
    }
    if (nextState !== "idle" && returnToIdleMs > 0) {
      stateTimerRef.current = setTimeout(() => {
        setSystemState("idle");
      }, returnToIdleMs);
    }
  }, []);

  // Ingest an inspection frame result (Core Handoff function for AI Engineer & Local Ingest)
  const ingestInspection = useCallback(
    (payload: IngestInspectionPayload) => {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")} Sep 2026, ${now
        .getHours()
        .toString()
        .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} WIB`;

      const isDefect = payload.defectDetected;
      const confidenceVal = payload.confidence ?? 95.0;
      const defectClassVal = payload.defectClass || (isDefect ? "Porosity / Crack" : "None (Passed)");
      const lotIdVal = payload.lotId || payload.batchId || stats.activeLot;
      const partNameVal = payload.partName || stats.activePart;
      const inspectionId = payload.id || `INS-LIVE-${Date.now().toString().slice(-5)}`;
      const escalationScoreVal = payload.escalationScore ?? (isDefect ? 0.88 : 0.15);

      // 1. Build Inspection Record
      const newRecord: InspectionRecord = {
        id: inspectionId,
        partName: partNameVal,
        batchId: lotIdVal,
        timestamp: formattedDate,
        rawDate: now.toISOString(),
        status: isDefect ? "Held" : "Passed",
        defectClass: defectClassVal,
        confidence: Number(confidenceVal.toFixed(1)),
        lotCount: 300,
        supplier: payload.supplier || "PT Krakatau Scrap Ind.",
        line: payload.line || "Station #01 (Conveyor Cam-01)",
        reasoningSteps: (payload.reasoningSteps || [
          {
            step: "01",
            phase: "DETECT",
            title: "YOLOv8-Nano Inference",
            detail: isDefect
              ? `Defect anomaly (${defectClassVal}) detected with ${confidenceVal.toFixed(1)}% confidence.`
              : "Conveyor vision scan completed: Component passes ISO 286 tolerance limits.",
            latency: "5.2ms",
          },
          {
            step: "02",
            phase: "DECISION",
            title: isDefect ? "Material Quarantine Hold" : "Direct Release to Assembly",
            detail: isDefect
              ? `Escalation score ${escalationScoreVal.toFixed(2)} triggered autonomous quarantine hold.`
              : "Quality standards satisfied. Component routed along primary assembly conveyor.",
            latency: "28ms",
          },
        ]).map((step) => ({
          step: step.step,
          phase: step.phase,
          title: step.title || `${step.step}. ${step.phase}`,
          detail: step.detail,
          latency: step.latency,
        })),
      };

      // 2. Prepend to inspections list
      setInspections((prev) => [newRecord, ...prev]);

      // 3. Update Aggregate KPI Stats
      setStats((prev) => {
        const nextTotal = prev.totalInspections + 1;
        const nextPassed = isDefect ? prev.passedUnits : prev.passedUnits + 1;
        const nextDefects = isDefect ? prev.defectUnits + 1 : prev.defectUnits;
        const nextRate = Number(((nextDefects / nextTotal) * 100).toFixed(1));
        const nextHeldCount = isDefect ? prev.batchesHeldCount + 1 : prev.batchesHeldCount;

        return {
          ...prev,
          totalInspections: nextTotal,
          passedUnits: nextPassed,
          defectUnits: nextDefects,
          defectRate: nextRate,
          batchesHeldCount: nextHeldCount,
          activeLot: lotIdVal,
          activePart: partNameVal,
          escalationScore: escalationScoreVal,
        };
      });

      // 4. Update 3D Digital Twin State
      triggerSystemState(isDefect ? "defect" : "ok", 7000);

      // 5. Update Batch Status if Defect
      if (isDefect) {
        setBatches((prev) =>
          prev.map((b) => {
            const matches = b.id.toLowerCase() === lotIdVal.toLowerCase() || b.id.replace("#", "").toLowerCase() === lotIdVal.replace("#", "").toLowerCase();
            if (matches) {
              return {
                ...b,
                status: "held",
                zone: "quarantine",
                defectCount: b.defectCount + 1,
                escalationScore: escalationScoreVal,
                timeAgo: "Just now",
              };
            }
            return b;
          })
        );

        // 6. Push Notification Alert
        const notifId = `notif-${Date.now()}`;
        const newNotif: NotificationItem = {
          id: notifId,
          title: `Cacat Terdeteksi: ${defectClassVal}`,
          message: `Anomali kualitas terdeteksi pada ${lotIdVal} (${partNameVal}). Skor eskalasi: ${escalationScoreVal.toFixed(2)}.`,
          timestamp: "Just now",
          type: "quarantine",
          read: false,
          href: "/dashboard/inspection",
          lotId: lotIdVal,
        };
        setNotifications((prev) => [newNotif, ...prev]);
      }
    },
    [stats.activeLot, stats.activePart, triggerSystemState]
  );

  // Approve a Batch
  const approveBatch = useCallback((batchId: string) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              status: "released",
              zone: "standard",
              timeAgo: "Just now",
            }
          : b
      )
    );

    setStats((prev) => ({
      ...prev,
      batchesHeldCount: Math.max(0, prev.batchesHeldCount - 1),
    }));

    const newNotif: NotificationItem = {
      id: `notif-appr-${Date.now()}`,
      title: "Pelepasan Batch Disetujui",
      message: `Batch ${batchId} berhasil disetujui supervisor untuk perakitan lini utama.`,
      timestamp: "Just now",
      type: "approval",
      read: false,
      href: "/dashboard/batches",
      lotId: batchId,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  // Reject a Batch (Hold in Quarantine)
  const rejectBatch = useCallback((batchId: string) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              status: "held",
              zone: "quarantine",
              timeAgo: "Just now",
            }
          : b
      )
    );

    setStats((prev) => ({
      ...prev,
      batchesHeldCount: prev.batchesHeldCount + 1,
    }));

    const newNotif: NotificationItem = {
      id: `notif-rej-${Date.now()}`,
      title: "Batch Ditahan di Karantina",
      message: `Batch ${batchId} ditahan dan dialihkan ke Zona Karantina. Tiket notifikasi mutu dikirim ke SAP QM.`,
      timestamp: "Just now",
      type: "quarantine",
      read: false,
      href: "/dashboard/batches",
      lotId: batchId,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  // Create a new Dispatch ticket
  const createDispatch = useCallback((item: DispatchItem) => {
    setDispatches((prev) => [item, ...prev]);

    const newNotif: NotificationItem = {
      id: `notif-dsp-${Date.now()}`,
      title: `Tiket Dispatch ${item.consumer} Dibuat`,
      message: `Tiket ${item.id} (${item.triggerReason}) berhasil diteruskan ke modul ${item.consumer}.`,
      timestamp: "Just now",
      type: "sap",
      read: false,
      href: "/dashboard/dispatch",
      lotId: item.batchId,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  // Save System Settings
  const saveSettings = useCallback((newSettings: SettingsState) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("sigap_system_settings", JSON.stringify(newSettings));
    } catch {}
  }, []);

  // Mark single notification as read
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Auto-sync with Server-Sent Events (SSE) from Backend
  useSigapEvents({
    onInspectionCreated: (newIns) => {
      const isDefect =
        newIns.defectDetected ??
        (newIns.defectClass && newIns.defectClass.toLowerCase() !== "ok");

      ingestInspection({
        id: newIns.id,
        defectDetected: isDefect,
        defectClass: newIns.defectClass,
        confidence: newIns.confidence,
        severity: newIns.severity,
        escalationScore: newIns.escalationScore,
        lotId: newIns.batchId || newIns.lotId,
        partName: newIns.partName,
        supplier: newIns.supplier,
        line: newIns.line,
        reasoningSteps: newIns.agentReasoningTrace,
        sapDispatches: newIns.sapDispatches,
      });
    },
    onAgentLog: (data) => {
      const phase = (data?.phase || data?.stepName || "").toUpperCase();
      if (phase === "DETECT" || phase === "SCAN" || phase === "INSPECT") {
        triggerSystemState("scanning", 3500);
      }
    },
    onBatchStatusChanged: (data) => {
      if (data.lotId) {
        setBatches((prev) =>
          prev.map((b) => {
            const matches = b.id.toLowerCase() === data.lotId.toLowerCase() || b.id.replace("#", "").toLowerCase() === data.lotId.replace("#", "").toLowerCase();
            if (matches) {
              return {
                ...b,
                status: data.status || b.status,
                zone: data.storageZone || b.zone,
                escalationScore: data.escalationScore ?? b.escalationScore,
              };
            }
            return b;
          })
        );
      }
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
      ingestInspection,
      approveBatch,
      rejectBatch,
      createDispatch,
      saveSettings,
      markNotificationAsRead,
      markAllNotificationsAsRead,
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
      ingestInspection,
      approveBatch,
      rejectBatch,
      createDispatch,
      saveSettings,
      markNotificationAsRead,
      markAllNotificationsAsRead,
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

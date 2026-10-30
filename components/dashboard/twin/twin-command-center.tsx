"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TwinViewer } from "./twin-viewer";
import { TwinControlRail } from "./twin-control-rail";
import { TwinOverlayBadges } from "./twin-overlay-badges";
import { TwinProductionCard } from "./twin-production-card";
import { DashboardDefectDistribution } from "@/components/dashboard/dashboard-defect-distribution";
import { DashboardTrendChart } from "@/components/dashboard/dashboard-trend-chart";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";
import { DashboardPriorityItems } from "@/components/dashboard/dashboard-priority-items";
import { useSigapEvents } from "@/hooks/useSigapEvents";
import { useSigapGlobal } from "@/context/sigap-global-context";

interface TwinCommandCenterProps {
  stats: any;
}

export function TwinCommandCenter({ stats }: TwinCommandCenterProps) {
  const { systemState: globalSystemState, setSystemState: setGlobalSystemState, stats: globalStats } = useSigapGlobal();
  const [systemState, setSystemState] = useState<"idle" | "scanning" | "ok" | "defect">(globalSystemState || "idle");
  const [showBadges, setShowBadges] = useState(true);
  const [isLiveSSE, setIsLiveSSE] = useState(true);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (globalSystemState) {
      setSystemState(globalSystemState);
    }
  }, [globalSystemState]);

  const activeStats = {
    ...stats,
    ...globalStats,
  };

  // Helper to safely transition state and set auto-return to idle
  const transitionToState = useCallback((nextState: "idle" | "scanning" | "ok" | "defect", returnToIdleMs = 6000) => {
    setSystemState(nextState);
    setGlobalSystemState(nextState);
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    if (nextState !== "idle" && returnToIdleMs > 0) {
      idleTimeoutRef.current = setTimeout(() => {
        setSystemState("idle");
        setGlobalSystemState("idle");
      }, returnToIdleMs);
    }
  }, [setGlobalSystemState]);

  // Listen to real-time manufacturing events via SSE
  const { isConnected } = useSigapEvents({
    enabled: isLiveSSE,
    onInspectionCreated: (data) => {
      if (!isLiveSSE) return;
      const isDefect =
        data?.result === "DEFECT" ||
        (data?.defectClass && data.defectClass.toLowerCase() !== "ok");

      if (isDefect) {
        transitionToState("defect", 7000);
      } else {
        transitionToState("ok", 6000);
      }
    },
    onAgentLog: (data) => {
      if (!isLiveSSE) return;
      const phase = (data?.phase || data?.stepName || "").toUpperCase();
      if (phase === "DETECT" || phase === "SCAN" || phase === "INSPECT") {
        transitionToState("scanning", 4000);
      }
    },
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, []);

  return (
    <div className="w-full flex flex-col bg-[#E1E7ED]" style={{ backgroundColor: "#E1E7ED" }}>
      {/* 1. SECTION 1: SPLIT HERO (Spline Kiri + Panel Kanan Solid) */}
      <section
        className="flex flex-col lg:flex-row w-full bg-[#E1E7ED] border-b border-slate-300/40 relative"
        style={{ backgroundColor: "#E1E7ED" }}
      >
        {/* KIRI: 3D Spline Canvas + Overlays (Title, Control Rail, 3D Badges, Bottom Bar) */}
        <div className="relative flex-1 min-w-0 h-[560px] lg:h-auto overflow-hidden">
          {/* BASE LAYER (z-0): 3D Digital Twin Canvas */}
          <div className="absolute inset-0 w-full h-full z-0">
            <TwinViewer
              systemState={systemState}
              onStateChangeFromTwin={(s: any) => {
                if (s === "idle" || s === "scanning" || s === "ok" || s === "defect") {
                  setSystemState(s);
                }
              }}
            />
          </div>

          {/* OVERLAY BADGES LAYER (z-10): Equipment & Sensor Badges */}
          <TwinOverlayBadges
            showBadges={showBadges}
            systemState={systemState}
            stats={{
              totalInspections: activeStats?.totalInspections,
              batchesHeldCount: activeStats?.batchesHeldCount,
              heldDefectPcs: activeStats?.defectUnits ?? activeStats?.heldDefectPcs,
              defectRate: activeStats?.defectRate,
            }}
          />

          {/* OVERLAY LAYER (z-20): Top-Left Title, Subtitle, Shift Status, & Control Rail */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
            className="absolute top-6 left-6 sm:left-8 max-w-xl z-20 pointer-events-auto flex flex-col gap-2.5"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Quality Operations Center
                </h1>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/90 text-slate-700 border border-slate-300/80 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Live Telemetry</span>
                </span>
              </div>
              <p className="font-sans text-xs sm:text-sm text-slate-600 font-normal max-w-md leading-relaxed">
                Real-time <strong className="font-semibold text-slate-900">YOLOv8</strong> defect detection, autonomous <strong className="font-semibold text-slate-900">AWS Bedrock</strong> reasoning, and <strong className="font-semibold text-slate-900">SAP</strong> ERP mutation dispatch.
              </p>
            </div>

            {/* Quick Shift Status Tag Pills */}
            <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-700">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-300/80 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium text-xs">Line: HPDC #02</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-300/80 shadow-2xs">
                <span className="text-slate-400 text-xs">First-pass yield:</span>
                <span className="text-slate-900 font-semibold text-xs">
                  {typeof activeStats?.firstPassYieldPct === "number" ? `${activeStats.firstPassYieldPct}%` : "—"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* OVERLAY LAYER (z-20): Bottom Floating Bar (Control Rail & Scroll Hint) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
            className="absolute bottom-6 left-6 right-6 sm:left-8 sm:right-8 z-20 flex items-center justify-between gap-4 pointer-events-none"
          >
            <TwinControlRail
              currentState={systemState}
              onSelectState={(s) => {
                setIsLiveSSE(false); // Manual override
                transitionToState(s, s === "idle" ? 0 : 7000);
              }}
              showBadges={showBadges}
              onToggleBadges={() => setShowBadges((v) => !v)}
              isLiveSSE={isLiveSSE}
              onToggleLiveSSE={() => setIsLiveSSE((v) => !v)}
              isConnected={isConnected}
            />

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("analytics-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 text-xs font-medium text-slate-700 shadow-sm hover:bg-white hover:text-slate-900 transition-all cursor-pointer group ml-auto shrink-0"
            >
              <span>Scroll to Analytics</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* KANAN: Dedicated Solid Panel (Bg persis sama dengan Spline #E1E7ED) */}
        <aside
          className="relative z-20 w-full lg:w-[400px] shrink-0 bg-[#E1E7ED] py-6 lg:pl-3 lg:pr-6 flex flex-col gap-2.5"
          style={{ backgroundColor: "#E1E7ED" }}
        >
          <TwinProductionCard
            totalInspections={activeStats?.totalInspections}
            activeLotId={activeStats?.activeLot || activeStats?.activeLotId}
            defectRate={activeStats?.defectRate}
            dpmo={activeStats?.dpmo}
            firstPassYieldPct={activeStats?.firstPassYieldPct}
            batchesHeldCount={activeStats?.batchesHeldCount}
            heldDefectPcs={activeStats?.defectUnits ?? activeStats?.heldDefectPcs}
            dispatchesCount={activeStats?.dispatchesCount}
          />
        </aside>
      </section>

      {/* 2. SECTION 2: OPERATIONAL ANALYTICS (FlowDesk Light Canvas #F8F9FB) */}
      <section
        id="analytics-section"
        className="w-full bg-[#F8F9FB] pt-10 pb-16 px-6 sm:px-8 border-t border-slate-200/80"
        style={{ backgroundColor: "#F8F9FB" }}
      >
        <div className="max-w-[1720px] mx-auto space-y-6">
          {/* Section 2 Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/70">
            <div>
              <h2 className="font-sans text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Production Line &amp; Quality Analytics
              </h2>
              <p className="font-sans text-xs sm:text-sm text-slate-500 mt-1">
                Real-time defect distribution, hourly trends, and SAP OData mutation history.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const mainEl = document.querySelector("main");
                  if (mainEl) {
                    mainEl.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer group"
                title="Scroll back to 3D Digital Twin"
              >
                <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-y-0.5 transition-transform" />
                <span>Back to 3D Twin</span>
              </button>
              <div className="text-xs font-medium text-slate-700 bg-white border border-slate-200/80 rounded-full px-3 py-1 flex items-center gap-2 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Active SAP QM/MM/PP Sync</span>
              </div>
            </div>
          </div>

          {/* Row 1: Hourly Trend Chart (8 cols) + Defect Distribution Radial Gauge (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8">
              <DashboardTrendChart trend={activeStats?.defectTrend} />
            </div>
            <div className="lg:col-span-4">
              <DashboardDefectDistribution disposition={activeStats?.defectDisposition} />
            </div>
          </div>

          {/* Row 2: Agent Decisions Timeline (6 cols) + Priority Items (6 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-6">
              <DashboardRecentActivity />
            </div>
            <div className="lg:col-span-6">
              <DashboardPriorityItems />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { InspectionCameraPanel } from "@/components/inspection/inspection-camera-panel";
import { InspectionEventsList } from "@/components/inspection/inspection-events-list";
import { InspectionAgentTrace } from "@/components/inspection/inspection-agent-trace";
import { InspectionEscalationGauge } from "@/components/inspection/inspection-escalation-gauge";

import { useSigapGlobal } from "@/context/sigap-global-context";

interface InspectionViewClientProps {
  activeLot: string;
  activePart: string;
  escalationScore: number;
  liveEvents?: any[];
  liveTraces?: any[];
}

export function InspectionViewClient({
  activeLot,
  activePart,
  escalationScore,
  liveEvents,
  liveTraces,
}: InspectionViewClientProps) {
  const { ingestInspection } = useSigapGlobal();
  const [currentScore, setCurrentScore] = useState(escalationScore);
  const [currentTraces, setCurrentTraces] = useState(liveTraces);

  const handleAnalysisComplete = (data: any) => {
    if (!data) return;
    const isDef = data.inspection?.defectDetected;
    if (data.escalationScore !== undefined) {
      setCurrentScore(data.escalationScore);
    }
    if (data.reasoningSteps || data.inspection?.agentReasoningTrace) {
      setCurrentTraces(data.reasoningSteps || data.inspection?.agentReasoningTrace);
    }

    ingestInspection({
      id: data.inspection?.id,
      defectDetected: isDef,
      defectClass: data.inspection?.defectClass,
      confidence: data.inspection?.confidence,
      severity: data.inspection?.severity,
      escalationScore: data.escalationScore,
      lotId: activeLot,
      partName: activePart,
      boundingBoxes: data.boundingBoxes,
      reasoningSteps: data.inspection?.agentReasoningTrace || data.reasoningSteps,
      sapDispatches: data.sapDispatches,
    });
  };
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 select-none">
      {/* Tahap 1: Page Title & Context Header (0ms - 150ms) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Optical Inspection &amp; AI Reasoning
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Vision Agent Online
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-slate-500">
            Station #01 conveyor optical feed, YOLOv8-Nano bounding box inference, and autonomous AWS Bedrock escalation reasoning.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs text-slate-600">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-medium">
            <span className="text-slate-400">Lot:</span>
            <span className="text-slate-900 font-semibold">{activeLot}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-medium">
            <span className="text-slate-400">Part:</span>
            <span className="text-slate-900 font-semibold">{activePart}</span>
          </div>
        </div>
      </motion.div>

      {/* Two-Column Split Layout (60% Left, 40% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tahap 2: LEFT COLUMN (60%): Live Camera & File Upload Panel (150ms - 350ms) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "transform, opacity" }}
          className="lg:col-span-7 xl:col-span-7"
        >
          <InspectionCameraPanel
            lotId={activeLot}
            productType={activePart}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </motion.div>

        {/* RIGHT COLUMN (40%): Stacked Events, Trace, and Escalation Gauge */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6">
          {/* Tahap 3A: Top Panel - Recent Events (350ms - 450ms) */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <InspectionEventsList events={liveEvents} />
          </motion.div>

          {/* Tahap 3B: Middle Panel - Agent Reasoning Trace (450ms - 550ms) */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <InspectionAgentTrace traces={currentTraces} />
          </motion.div>

          {/* Tahap 4: Bottom Panel - Escalation Score Gauge (550ms - 750ms) */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <InspectionEscalationGauge
              score={currentScore}
              lotId={`Lot ${activeLot}`}
              partName={activePart}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

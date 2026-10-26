"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, CheckCircle2, ShieldAlert, Activity } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

const DEFAULT_TRACES = [
  {
    step: "01. DETECT",
    timestamp: "14:32:01.042",
    tag: "YOLOv8-Nano",
    tagColor: "text-blue-700 bg-blue-50 border-blue-200/70",
    content:
      "Casting surface defect anomaly detected on frame #1428 along Station #01 conveyor.",
    metric: "Confidence: 94.2% • Latency: 78ms",
  },
  {
    step: "02. MEMORY",
    timestamp: "14:32:01.180",
    tag: "Bedrock-Memory",
    tagColor: "text-amber-700 bg-amber-50 border-amber-200/70",
    content:
      "Temporal correlation analysis: 3 recurring defect anomalies detected within last 8 minutes on same lot.",
    metric: "Supplier: PT Krakatau Scrap • Recurring Pattern",
  },
  {
    step: "03. FORMULA",
    timestamp: "14:32:01.320",
    tag: "Formula-Engine",
    tagColor: "text-emerald-700 bg-emerald-50 border-emerald-200/70",
    content:
      "Escalation score formula: (Frequency × 0.40) + (Severity × 0.35) + (History × 0.25).",
    metric: "Calculated Score: 0.74 (Level 3)",
  },
  {
    step: "04. DECISION",
    timestamp: "14:32:01.490",
    tag: "Autonomous-Agent",
    tagColor: "text-rose-700 bg-rose-50 border-rose-200/70",
    content:
      "Threshold >0.70 exceeded. Autonomous agent triggered lot quarantine and ERP escalation without manual intervention.",
    metric: "Status: Level 3 Pattern Confirmed",
  },
  {
    step: "05. DISPATCH",
    timestamp: "14:32:01.680",
    tag: "SAP-Integration",
    tagColor: "text-purple-700 bg-purple-50 border-purple-200/70",
    content:
      "Dispatched quality notification ticket to SAP QM and flagged supplier UnderReview in SAP MM.",
    metric: "HTTP 201 Created • S3 Audit Trail Stored",
  },
];

interface InspectionAgentTraceProps {
  traces?: any[];
}

export function InspectionAgentTrace({ traces: initialTraces }: InspectionAgentTraceProps) {
  const [traces, setTraces] = useState<any[]>(
    initialTraces && initialTraces.length > 0 ? initialTraces : DEFAULT_TRACES
  );
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (initialTraces && initialTraces.length > 0) {
      setTraces(initialTraces);
    }
  }, [initialTraces]);

  const updateTracesFromData = (incomingTraces: any[]) => {
    if (!Array.isArray(incomingTraces) || incomingTraces.length === 0) return;

    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const formatted = incomingTraces.map((t: any) => {
      const phase = t.phase || t.stepName || "DETECT";
      let tag = "Autonomous-Agent";
      let tagColor = "text-rose-700 bg-rose-50 border-rose-200/70";

      if (phase === "DETECT") {
        tag = "YOLOv8-Nano";
        tagColor = "text-blue-700 bg-blue-50 border-blue-200/70";
      } else if (phase === "MEMORY") {
        tag = "Bedrock-Memory";
        tagColor = "text-amber-700 bg-amber-50 border-amber-200/70";
      } else if (phase === "FORMULA") {
        tag = "Formula-Engine";
        tagColor = "text-emerald-700 bg-emerald-50 border-emerald-200/70";
      } else if (phase === "DISPATCH") {
        tag = "SAP-Integration";
        tagColor = "text-purple-700 bg-purple-50 border-purple-200/70";
      }

      return {
        step: t.step ? `${t.step}. ${phase}` : `01. ${phase}`,
        timestamp: `${timeStr}.${Math.floor(100 + Math.random() * 899)}`,
        tag,
        tagColor,
        content: t.detail || t.content || (t.decision ? `Decision: ${t.decision}` : "Model reasoning verified."),
        metric: t.latency ? `Latency: ${t.latency}` : t.metric || "Confidence Verified",
      };
    });

    setIsUpdating(true);
    setTraces(formatted);
    setTimeout(() => setIsUpdating(false), 2000);
  };

  // Listen to live SSE events
  const { isConnected } = useSigapEvents({
    onAgentLog: (payload) => {
      if (payload.traces) {
        updateTracesFromData(payload.traces);
      }
    },
    onInspectionCreated: (payload) => {
      if (payload.agentReasoningTrace && Array.isArray(payload.agentReasoningTrace)) {
        updateTracesFromData(payload.agentReasoningTrace);
      }
    },
  });

  return (
    <div className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between select-none hover:-translate-y-1 hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-sans text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
              Agent Reasoning Trace
            </h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold shrink-0">
              AWS Bedrock
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Step-by-step autonomous reasoning &amp; deduction logs
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isUpdating && (
            <span className="text-xs text-blue-600 font-semibold">
              Updating trace...
            </span>
          )}
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200/70 text-slate-600">
            <Brain className="w-4 h-4 text-slate-700" />
          </div>
        </div>
      </div>

      {/* Reasoning Container (FlowDesk Light Timeline) */}
      <div
        className={`rounded-xl bg-slate-50/80 border p-4 sm:p-5 transition-colors duration-300 ${
          isUpdating ? "border-blue-400" : "border-slate-200/80"
        }`}
      >
        {/* Sub-Header Status Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Autonomous Deduction Pipeline</span>
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className={isConnected ? "text-emerald-700 font-semibold" : "text-amber-700"}>
              {isConnected ? "Stream Synced" : "Standby"}
            </span>
          </span>
        </div>

        {/* Trace Steps List */}
        <div className="space-y-3">
          {traces.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.48 + idx * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ willChange: "transform, opacity" }}
              className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs hover:border-slate-300 transition-colors"
            >
              {/* Step Meta Tag Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs font-bold text-slate-900">
                    {t.step}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${t.tagColor}`}
                  >
                    {t.tag}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {t.timestamp}
                </span>
              </div>

              {/* Explanatory Human-Readable Text */}
              <p className="font-sans text-xs text-slate-700 leading-relaxed font-normal">
                {t.content}
              </p>

              {/* Technical Fragment Readout */}
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
                <span>{t.metric}</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-semibold">
                  Verified
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Status Prompt */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-700 font-semibold">
              Agent Active • Listening on Vision Stream
            </span>
          </div>
          <span className="text-slate-400">Model: Claude 3.5 Sonnet</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, ShieldAlert, Activity, Clock } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

export interface StageTrace {
  step: string;
  stage: "DETECT" | "MEMORY" | "FORMULA" | "DECISION" | "DISPATCH";
  title?: string;
  tag: string;
  tagColor: string;
  content: string;
  metric: string;
  status?: string;
  timestamp?: string;
  runId?: string;
  sequence?: number;
}

interface InspectionAgentTraceProps {
  traces?: StageTrace[];
  provider?: string;
  inspectionId?: string;
}

export function InspectionAgentTrace({
  traces: initialTraces,
  provider = "Cloud AI Reasoning",
  inspectionId,
}: InspectionAgentTraceProps) {
  const [traces, setTraces] = useState<StageTrace[]>(initialTraces || []);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (initialTraces && initialTraces.length > 0) {
      setTraces(initialTraces);
    }
  }, [initialTraces]);

  const updateTracesFromData = (incomingTraces: unknown[]) => {
    if (!Array.isArray(incomingTraces) || incomingTraces.length === 0) return;

    const formatted: StageTrace[] = incomingTraces.map((t: any) => {
      const stage = (t.stage || t.phase || t.stepName || "DETECT").toUpperCase() as StageTrace["stage"];
      let tag = "Governed-Agent";
      let tagColor = "text-rose-700 bg-rose-50 border-rose-200/70";

      if (stage === "DETECT") {
        tag = "ONNX Vision";
        tagColor = "text-blue-700 bg-blue-50 border-blue-200/70";
      } else if (stage === "MEMORY") {
        tag = "Postgres-Context";
        tagColor = "text-amber-700 bg-amber-50 border-amber-200/70";
      } else if (stage === "FORMULA") {
        tag = "Policy-Engine";
        tagColor = "text-emerald-700 bg-emerald-50 border-emerald-200/70";
      } else if (stage === "DISPATCH") {
        tag = "SAP-Simulator";
        tagColor = "text-purple-700 bg-purple-50 border-purple-200/70";
      }

      const metric =
        typeof t.latencyMs === "number"
          ? `${t.latencyMs}ms`
          : t.latency || (t.status === "skipped" ? "Skipped" : t.status ? `Status: ${t.status}` : undefined);

      return {
        step: t.step ? `${t.step}. ${stage}` : stage,
        stage,
        tag,
        tagColor,
        content: t.detail || t.content || (t.decision ? `Decision: ${t.decision}` : "Evidence recorded."),
        metric,
        status: t.status || "pending",
        // `timestamp` is a pre-formatted WIB string; parse the ISO field instead
        timestamp: (t.startedAt || t.rawDate) ? new Date(t.startedAt || t.rawDate).toLocaleTimeString() : undefined,
        runId: t.runId,
        sequence: t.sequence,
      };
    });

    setIsUpdating(true);
    // Sort deterministically by sequence if present
    setTraces(
      formatted.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    );
    setTimeout(() => setIsUpdating(false), 1500);
  };

  useSigapEvents({
    onAgentLog: (payload) => {
      if (payload && payload.inspectionId === inspectionId && payload.traces) {
        updateTracesFromData(payload.traces);
      }
    },
  });
  useEffect(() => {
    setTraces([]);
    if (!inspectionId) return;

    let active = true;
    const fetchLogs = async () => {
      try {
        const res = await fetch(
          `/api/agent/logs?inspectionId=${encodeURIComponent(inspectionId)}&limit=100`
        );
        if (res.ok && active) {
          const json = await res.json();
          if (json.success) {
            if (Array.isArray(json.data) && json.data.length > 0) {
              updateTracesFromData(json.data);
            } else {
              setTraces([]);
            }
          }
        }
      } catch {
        // polling error ignored
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [inspectionId]);

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
              {provider}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Step-by-step accountable reasoning &amp; evidence deduction logs
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isUpdating ? (
            <span className="flex items-center gap-1 text-[11px] font-mono font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 animate-pulse">
              <Activity className="w-3 h-3 animate-spin" />
              <span>SYNCING</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <CheckCircle2 className="w-3 h-3" />
              <span>SYNCHRONIZED</span>
            </span>
          )}
        </div>
      </div>

      {/* Trace Timeline Cards */}
      <div className="space-y-3">
        {traces.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-mono">
            {inspectionId
              ? "No reasoning traces recorded yet for this inspection."
              : "Analyze an image to view agent reasoning deduction logs."}
          </div>
        ) : (
          traces.map((trace, index) => (
            <motion.div
              key={`${trace.runId || "trace"}-${trace.sequence || index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {trace.step}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border ${trace.tagColor}`}
                  >
                    {trace.tag}
                  </span>
                </div>
                {trace.timestamp && (
                  <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {trace.timestamp}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-700 leading-relaxed font-sans mb-1.5">
                {trace.content}
              </p>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                <span>{trace.metric}</span>
                {trace.status && (
                  <span
                    className={`font-semibold capitalize ${
                      trace.status === "completed"
                        ? "text-emerald-600"
                        : trace.status === "failed"
                        ? "text-rose-600"
                        : "text-amber-600"
                    }`}
                  >
                    {trace.status}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
        {traces.length > 0 &&
          !traces.some((t) => t.stage === "DECISION" || t.stage === "DISPATCH") && (
            <div className="p-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 flex items-center gap-2 text-xs text-blue-700 font-mono">
              <Activity className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Awaiting cloud agent reasoning…</span>
            </div>
          )}
      </div>
    </div>
  );
}

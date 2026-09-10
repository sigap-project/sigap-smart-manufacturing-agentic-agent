"use client";

import { useState, useEffect } from "react";
import { Terminal, Brain, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

const DEFAULT_TRACES = [
  {
    step: "01. DETECT",
    timestamp: "14:32:01.042",
    tag: "YOLOv8-Nano",
    tagColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    content:
      "Anomali casting 'defect' terdeteksi pada frame #1428 di konveyor Station #01.",
    metric: "Confidence: 94.2% • Latensi: 78ms",
  },
  {
    step: "02. MEMORY",
    timestamp: "14:32:01.180",
    tag: "Bedrock-Memory",
    tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    content:
      "Analisis korelasi temporal: 3 anomali defect serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
    metric: "Vendor: PT Krakatau Scrap • Pola Berulang",
  },
  {
    step: "03. FORMULA",
    timestamp: "14:32:01.320",
    tag: "Formula-Engine",
    tagColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    content:
      "Kalkulasi skor eskalasi: (Frekuensi × 0.40) + (Severity × 0.35) + (Histori × 0.25).",
    metric: "Skor Terkalkulasi: 0.74 (Level 3)",
  },
  {
    step: "04. DECISION",
    timestamp: "14:32:01.490",
    tag: "Autonomous-Agent",
    tagColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    content:
      "Ambang batas >0.70 terlampaui. Agen menyetujui karantina batch dan eskalasi ERP tanpa intervensi manual.",
    metric: "Status: Level 3 Pattern Confirmed",
  },
  {
    step: "05. DISPATCH",
    timestamp: "14:32:01.680",
    tag: "SAP-Integration",
    tagColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    content:
      "Menerbitkan tiket notifikasi cacat ke SAP QM dan memberi flag UnderReview pada supplier di SAP MM.",
    metric: "HTTP 201 Created • Audit Trail S3 Stored",
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

    const timeStr = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const formatted = incomingTraces.map((t: any) => {
      const phase = t.phase || t.stepName || "DETECT";
      let tag = "Autonomous-Agent";
      let tagColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";

      if (phase === "DETECT") {
        tag = "YOLOv8-Nano";
        tagColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      } else if (phase === "MEMORY") {
        tag = "Bedrock-Memory";
        tagColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      } else if (phase === "FORMULA") {
        tag = "Formula-Engine";
        tagColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (phase === "DISPATCH") {
        tag = "SAP-Integration";
        tagColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      }

      return {
        step: t.step ? `${t.step}. ${phase}` : `01. ${phase}`,
        timestamp: `${timeStr}.${Math.floor(100 + Math.random() * 899)}`,
        tag,
        tagColor,
        content: t.detail || t.content || (t.decision ? `Keputusan: ${t.decision}` : "Penalaran model diverifikasi."),
        metric: t.latency ? `Latensi: ${t.latency}` : t.metric || "Confidence Verified",
      };
    });

    setIsUpdating(true);
    setTraces(formatted);
    setTimeout(() => setIsUpdating(false), 2000);
  };

  // Dengarkan event penalaran agen dan inspeksi baru via SSE
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
    <div className="rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4 pb-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-white tracking-tight whitespace-nowrap">
              Agent Reasoning Trace
            </h3>
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
              AWS BEDROCK
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
            Jejak deduksi bertahap penalaran agen otonom
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isUpdating && (
            <span className="font-mono text-[10px] text-emerald-400 animate-pulse">
              [NEW TRACE]
            </span>
          )}
          <div className="p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400">
            <Terminal className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Softened Terminal Container */}
      <div
        className={`rounded-2xl bg-[#06080d] border p-4 sm:p-5 shadow-inner transition-colors duration-300 ${
          isUpdating ? "border-emerald-500/50" : "border-white/[0.07]"
        }`}
      >
        {/* Terminal Window Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] text-[10px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span>aws-bedrock-agent-core::reasoning-trace</span>
          <span className={isConnected ? "text-emerald-400" : "text-amber-400"}>
            {isConnected ? "STREAM-SYNCED" : "STANDBY"}
          </span>
        </div>

        {/* Trace Steps List */}
        <div className="space-y-3">
          {traces.map((t, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
            >
              {/* Step Meta Tag Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-zinc-300">
                    {t.step}
                  </span>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.2 rounded border ${t.tagColor}`}
                  >
                    {t.tag}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500">
                  {t.timestamp}
                </span>
              </div>

              {/* Explanatory Human-Readable Text */}
              <p className="font-sans text-xs text-zinc-300 leading-relaxed">
                {t.content}
              </p>

              {/* Technical Fragment Readout */}
              <div className="mt-1.5 pt-1.5 border-t border-white/[0.04] font-mono text-[10px] text-emerald-400/90 flex items-center gap-1.5">
                <span className="text-zinc-600">&gt;</span>
                <span>{t.metric}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Blinking Terminal Prompt */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-semibold">
              AGENT ACTIVE • LISTENING ON VISION STREAM
            </span>
          </div>
          <span className="text-zinc-600">Model: Claude 3.5 Sonnet</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Brain,
  Send,
  ChevronRight,
  ShieldAlert,
  Cpu,
  Layers,
  Activity,
  Scan,
  Radio,
} from "lucide-react";

interface AgentTelemetryCardProps {
  onOpenDemo?: () => void;
}

type TabKey = "detect" | "reasoning" | "dispatch";

export function AgentTelemetryCard({ onOpenDemo }: AgentTelemetryCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("detect");
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const tabs: { key: TabKey; label: string; icon: typeof Zap }[] = [
    { key: "detect", label: "Auto-Detect", icon: Zap },
    { key: "reasoning", label: "Reasoning", icon: Brain },
    { key: "dispatch", label: "SAP Dispatch", icon: Send },
  ];

  // Auto-cycle through the 3 tabs to show the autonomous loop in action
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveTab((current) => {
        if (current === "detect") return "reasoning";
        if (current === "reasoning") return "dispatch";
        return "detect";
      });
    }, 4800);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const narratives: Record<
    TabKey,
    {
      title: string;
      description: string;
      telemetry: { label: string; value: string; highlight?: boolean }[];
      badge: string;
      badgeColor: string;
    }
  > = {
    detect: {
      title: "YOLOv8-Nano Live Optical Scan",
      description:
        "Kamera piramid optik Station #01 memindai komponen impeller casting lot #B-2026-0730. Anomali 'defect' terdeteksi dalam 5.3ms.",
      badge: "Frame #1428 • Scan Passed",
      badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
      telemetry: [
        { label: "Confidence", value: "95.0%", highlight: true },
        { label: "Latency", value: "5.3ms" },
        { label: "Status Deteksi", value: "defect" },
      ],
    },
    reasoning: {
      title: "AWS Bedrock Pattern Reasoning",
      description:
        "3 anomali cacat berulang dalam 8 menit terakhir terdeteksi. Formula eskalasi menghitung skor 0.74 (ambang batas >0.70) memicu eskalasi otonom.",
      badge: "Pola Terkonfirmasi • Level 3",
      badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/25",
      telemetry: [
        { label: "Skor Eskalasi", value: "0.74", highlight: true },
        { label: "Frekuensi", value: "3 cacat / 8 min" },
        { label: "Supplier Hist.", value: "Repeat Flagged" },
      ],
    },
    dispatch: {
      title: "Autonomous ERP Business Dispatch",
      description:
        "Agent memicu POST /QualityNotification ke SAP QM, meletakkan flag UnderReview di SAP MM, dan mengusulkan reschedule SAP PP.",
      badge: "3 Action Groups Executed",
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
      telemetry: [
        { label: "SAP QM", value: "POST Success", highlight: true },
        { label: "SAP MM", value: "Supplier Flagged" },
        { label: "Audit Log", value: "Stored S3" },
      ],
    },
  };

  const current = narratives[activeTab];

  return (
    <motion.div
      initial={{ y: 28 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform", transform: "translateZ(0)" }}
      className="relative w-full max-w-xl mx-auto lg:ml-auto"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Outer Glow Effect matching emerald telemetry */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.25 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 rounded-[34px] blur-xl -z-10 pointer-events-none"
      />

      {/* Main Translucent Glassmorphic Card (Maintains full blur without blink) */}
      <div className="rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-colors duration-200 border border-white/[0.12] bg-[#06090e]/32 backdrop-blur-md shadow-2xl">
        {/* Subtle background ambient spotlight */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

        {/* Inner Content with smooth entrance reveal */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >

          {/* Top Header & Pill Badges with Framer Motion layoutId */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="relative flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-colors duration-200 cursor-pointer z-10 ${isActive ? "text-zinc-950 font-semibold" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-white rounded-full shadow-md shadow-white/20 -z-10"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Icon
                      className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-zinc-950" : "text-zinc-400"
                        }`}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Step Indicator Tag */}
            <span
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${current.badgeColor}`}
            >
              {current.badge}
            </span>
          </div>

          {/* Dynamic Context Narrative */}
          <div className="min-h-[105px] mb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="font-display text-base sm:text-lg font-bold text-white tracking-normal mb-2 flex items-center gap-2">
                  {current.title}
                </h3>
                <p className="font-sans text-sm text-zinc-300 leading-relaxed">
                  {current.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Telemetry Micro-Metrics Row in JetBrains Mono */}
          <div className="grid grid-cols-3 gap-2.5 mb-6 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            {current.telemetry.map((t, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="font-mono text-[10px] uppercase text-zinc-400 tracking-wider">
                  {t.label}
                </span>
                <span
                  className={`font-mono text-xs sm:text-sm font-semibold tracking-tight ${t.highlight
                      ? "text-emerald-400"
                      : "text-white"
                    }`}
                >
                  {t.value}
                </span>
              </div>
            ))}
          </div>

          {/* Nested Interactive Showcase Card with Simulated Optical Scanning Feed */}
          <div className="relative rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 border border-white/[0.08] shadow-lg overflow-hidden group hover:border-emerald-500/30 transition-colors">
            {/* Inner subtle noise/glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex items-center justify-between gap-4">
              {/* Left side: Simulated Optical Scanning Feed matching the video */}
              <div className="flex items-center gap-3.5">
                {/* Simulated Camera Feed Thumbnail with Bounding Box & Pyramid Laser Scan */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-zinc-950/90 border border-emerald-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                  {/* Crosshairs & Scanning Grid Mesh */}
                  <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:6px_6px]" />

                  {/* Simulated Metallic Cube from Video with Scanner Line */}
                  <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800 border border-zinc-500 relative flex items-center justify-center shadow-lg">
                    {/* Cyan pyramid laser simulation */}
                    <div className="absolute inset-0 bg-cyan-400/20 border border-cyan-400 animate-pulse" />
                    <span className="font-mono text-[7px] font-bold text-cyan-300">
                      A7
                    </span>
                  </div>

                  {/* Live REC pip */}
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                </div>

                {/* Text Info */}
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-display text-xs sm:text-sm font-bold text-white tracking-normal">
                      Eksplorasi Live QC Feed
                    </span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE
                    </span>
                  </div>
                  <p className="font-sans text-[11px] sm:text-xs text-zinc-300 leading-snug">
                    Mode: <span className="text-white font-medium">Human-in-the-Loop</span> • Klik untuk simulasi scan
                  </p>
                </div>
              </div>

              {/* Circular Emerald Action Button with Right Arrow */}
              <button
                onClick={onOpenDemo}
                aria-label="Buka Live Demo"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 hover:scale-105 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}


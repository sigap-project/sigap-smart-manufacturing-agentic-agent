"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Send,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoModal({ isOpen, onClose }: DemoModalProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [autonomyMode, setAutonomyMode] = useState<"approval" | "full_auto">("approval");
  const [currentStep, setCurrentStep] = useState(1);
  const [dispatchStatus, setDispatchStatus] = useState<"idle" | "pending" | "approved" | "dispatched">("idle");
  const [sapLogs, setSapLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset sequence on open
    setCurrentStep(1);
    setDispatchStatus("idle");
    setSapLogs([]);

    const step1Timer = setTimeout(() => {
      setCurrentStep(2);
    }, 1500);

    const step2Timer = setTimeout(() => {
      setCurrentStep(3);
      if (autonomyMode === "full_auto") {
        setDispatchStatus("dispatched");
        setSapLogs([
          "23:14:02 - POST /QualityNotification (SAP QM): 201 Created",
          "23:14:02 - PATCH /SupplierRecord/SUP-881 (SAP MM): Flag 'UnderReview' applied",
          "23:14:03 - POST /RescheduleRequest (SAP PP): Reschedule Proposal Sent",
        ]);
      } else {
        setDispatchStatus("pending");
      }
    }, 3000);

    return () => {
      clearTimeout(step1Timer);
      clearTimeout(step2Timer);
    };
  }, [isOpen, autonomyMode]);

  const handleApprove = () => {
    setDispatchStatus("dispatched");
    setSapLogs([
      "23:14:15 - Human Approval Confirmed by QC_SUPERVISOR_01",
      "23:14:16 - POST /QualityNotification (SAP QM): 201 Created",
      "23:14:16 - PATCH /SupplierRecord/SUP-881 (SAP MM): Flag 'UnderReview' applied",
      "23:14:17 - Audit Log recorded to PostgreSQL & S3",
    ]);
  };

  const handleReject = () => {
    setDispatchStatus("idle");
    setSapLogs(["23:14:20 - Dispatch Rejected by Human Supervisor. False positive logged for recalibration."]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#0a0d14] border border-white/[0.14] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#07090f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center overflow-hidden">
              <Image
                src="/image/image.png"
                alt="SIGAP Mascot"
                width={32}
                height={32}
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                Live Inspection &amp; Agent Reasoning Simulation
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  DEMO DAY MODE
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Sistem Deteksi Pengecoran Logam • Part #BR-902 (Bracket Otomotif)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Autonomy Mode Switcher (Core Differentiator from Master Context) */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-200">
                Mode Otonomi Agent:
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutonomyMode("approval")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  autonomyMode === "approval"
                    ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                    : "bg-white/[0.06] text-zinc-300 hover:text-white"
                }`}
              >
                ● Require Human Approval
              </button>
              <button
                onClick={() => setAutonomyMode("full_auto")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  autonomyMode === "full_auto"
                    ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                    : "bg-white/[0.06] text-zinc-300 hover:text-white"
                }`}
              >
                ○ Full Auto (Lights-Out)
              </button>
            </div>
          </div>

          {/* Two Panels: Camera Feed (Left) & Reasoning Trace (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Camera Feed Mock (60%) */}
            <div className="md:col-span-7 flex flex-col gap-3">
              <div className="relative aspect-video rounded-2xl bg-[#050608] border border-white/[0.1] overflow-hidden flex items-center justify-center shadow-inner">
                {/* Visual Grid & Target Crosshairs */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />

                {/* Simulated Metal Casting Component */}
                <div className="relative w-48 h-32 rounded-xl bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 border border-zinc-600 shadow-2xl flex items-center justify-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    Component #BR-902
                  </span>

                  {/* Defect Spot */}
                  <div className="absolute top-6 right-8 w-12 h-10 rounded border-2 border-red-500/80 bg-red-500/10 flex items-center justify-center animate-pulse">
                    <span className="absolute -top-5 right-0 bg-red-500 text-white font-mono font-bold text-[8px] px-1.5 py-0.5 rounded shadow">
                      warna_abnormal 94.2%
                    </span>
                  </div>
                </div>

                {/* Telemetry Overlays */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-[10px] font-mono text-red-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    LIVE
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded">
                    FPS: 30.0 • 78ms
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-emerald-400 bg-black/60 px-2.5 py-1 rounded border border-white/10">
                  Model: YOLOv8n-defect.onnx
                </div>
              </div>

              {/* Camera control bar */}
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>Lot: LOT-2026-0730-001</span>
                <span>Supplier: PT Baja Presisi Nusantara</span>
              </div>
            </div>

            {/* Right: Agent Reasoning Trace (40%) */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                <span>Agent Reasoning Trace</span>
              </div>

              <div className="space-y-2.5">
                {/* Step 1 */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 1
                      ? "bg-white/[0.04] border-emerald-500/40 text-white"
                      : "bg-white/[0.01] border-white/[0.05] text-zinc-500"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span>Step 1: Classification</span>
                    {currentStep >= 1 && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    Cacat 'warna_abnormal' terdeteksi (Confidence 94.2%).
                  </p>
                </div>

                {/* Step 2 */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 2
                      ? "bg-white/[0.04] border-amber-500/40 text-white"
                      : "bg-white/[0.01] border-white/[0.05] text-zinc-500"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span>Step 2: Pattern Analysis</span>
                    {currentStep >= 2 && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    3 cacat sejenis dalam 8 menit → Skor Eskalasi:{" "}
                    <strong className="text-amber-400 font-mono">0.74</strong>{" "}
                    (Threshold &gt; 0.70). Pola Terkonfirmasi.
                  </p>
                </div>

                {/* Step 3 */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 3
                      ? "bg-white/[0.04] border-cyan-500/40 text-white"
                      : "bg-white/[0.01] border-white/[0.05] text-zinc-500"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span>Step 3: Action Decision</span>
                    {dispatchStatus === "dispatched" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    Drafting SAP QM, MM, PP actions via AWS Bedrock Action Groups.
                  </p>
                </div>
              </div>

              {/* Human Approval Action Box if in approval mode */}
              {autonomyMode === "approval" && dispatchStatus === "pending" && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Konfirmasi Supervisor Dibutuhkan</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-tight">
                    Agent meminta persetujuan untuk menerbitkan notifikasi SAP QM dan menandai supplier.
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={handleApprove}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow"
                    >
                      Approve Dispatch
                    </button>
                    <button
                      onClick={handleReject}
                      className="py-1.5 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300 text-xs transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SAP Execution & Audit Console */}
          {sapLogs.length > 0 && (
            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-400 mb-2 border-b border-white/[0.06] pb-2">
                <span className="text-[11px] text-emerald-400 uppercase font-bold">
                  SAP Mock OData Execution Trace
                </span>
                <span className="text-[10px] text-zinc-500">Live API Log</span>
              </div>
              <div className="space-y-1 text-zinc-300 text-[11px]">
                {sapLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-emerald-500">✔</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#07090f] flex items-center justify-between text-xs text-zinc-400">
          <span>AI Agentic Hackathon SOKRATES × BINUS Alam Sutera 2026</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200 transition-colors"
          >
            Tutup Simulasi
          </button>
        </div>
      </div>
    </div>
  );
}

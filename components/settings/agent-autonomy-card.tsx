"use client";

import { Shield, Zap, UserCheck, Clock, Layers, Sparkles } from "lucide-react";
import { SettingsState } from "./types";

interface AgentAutonomyCardProps {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export function AgentAutonomyCard({
  settings,
  onChange,
}: AgentAutonomyCardProps) {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-emerald-500/[0.04] via-[#0b0e14]/90 to-[#0b0e14]/80 backdrop-blur-md border border-emerald-500/30 border-l-4 border-l-emerald-400 shadow-2xl shadow-emerald-950/20 p-5 sm:p-6 space-y-5 relative overflow-hidden">
      {/* Decorative Glow Pip */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 shadow-md shadow-emerald-500/20">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-white">
                SECTION 3 — Level Otonomi Agent
              </h3>
              <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                CORE AGENTIC LOGIC
              </span>
            </div>
            <p className="font-sans text-xs text-zinc-300">
              Konfigurasi derajat kemandirian agent cerdas dalam mengambil keputusan eskalasi manufaktur.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        {/* Toggle 1: Auto-simpan ke Batch Board */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">
                Auto-simpan ke Batch Board
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-sans block">
              Setiap batch lot hasil inspeksi optik otomatis tercatat ke Batch Board tanpa intervensi manual.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.autoSaveBatchBoard}
            onClick={() =>
              onChange("autoSaveBatchBoard", !settings.autoSaveBatchBoard)
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.autoSaveBatchBoard ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                settings.autoSaveBatchBoard ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Radio Group: Mode Auto-dispatch */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3">
          <div>
            <span className="text-xs font-semibold text-white block mb-0.5">
              Mode Auto-dispatch (Integrasi SAP ERP)
            </span>
            <p className="text-[11px] text-zinc-400 font-sans">
              Tentukan apakah agent diizinkan menerbitkan tiket ERP secara independen atau wajib melalui verifikasi manusia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Option 1: Full Otomatis */}
            <div
              onClick={() => onChange("autoDispatchMode", "autonomous")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                settings.autoDispatchMode === "autonomous"
                  ? "bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10"
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Full Otomatis (Autonomous)
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                    Agent otomatis mengirim tiket ke SAP QM, MM, dan PP seketika skor eskalasi melampaui &gt;0.70.
                  </p>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.autoDispatchMode === "autonomous"
                      ? "border-emerald-400 bg-emerald-500"
                      : "border-zinc-600"
                  }`}
                >
                  {settings.autoDispatchMode === "autonomous" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                  )}
                </div>
              </div>

              <span className="text-[10px] font-mono text-emerald-300">
                Respon Otonom: &lt; 1 Detik
              </span>
            </div>

            {/* Option 2: Perlu Persetujuan Manusia */}
            <div
              onClick={() => onChange("autoDispatchMode", "human_approval")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                settings.autoDispatchMode === "human_approval"
                  ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10"
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      Perlu Persetujuan Manusia
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                    Setiap eskalasi masuk ke antrean &ldquo;Menunggu Persetujuan&rdquo; dan wajib dikonfirmasi Supervisor QC.
                  </p>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.autoDispatchMode === "human_approval"
                      ? "border-amber-400 bg-amber-500"
                      : "border-zinc-600"
                  }`}
                >
                  {settings.autoDispatchMode === "human_approval" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                  )}
                </div>
              </div>

              <span className="text-[10px] font-mono text-amber-300">
                Human-in-the-Loop Active
              </span>
            </div>
          </div>
        </div>

        {/* Number Input: Batas Waktu Persetujuan (menit) */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-xs font-semibold text-white">
                Batas Waktu Persetujuan (SLA Menit)
              </label>
            </div>
            <span className="text-[11px] text-zinc-400 font-sans block">
              Batas waktu tunggu respon supervisor sebelum sistem mengirim peringatan sekunder ke Plant Head.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="60"
              value={settings.approvalTimeout}
              onChange={(e) =>
                onChange("approvalTimeout", parseInt(e.target.value) || 5)
              }
              className="w-20 px-3 py-2 text-xs font-mono font-bold text-white rounded-xl bg-black/60 border border-white/[0.1] focus:outline-none focus:border-emerald-500/50 text-center"
            />
            <span className="text-xs font-mono text-zinc-400">Menit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

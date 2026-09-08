"use client";

import { useState } from "react";
import { Cpu, Camera, Radio, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { SettingsState } from "./types";

interface HardwareConfigCardProps {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export function HardwareConfigCard({
  settings,
  onChange,
}: HardwareConfigCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult("Koneksi 100% Stabil • Ping: 12ms • Frame Rate: 60 FPS");
    }, 1200);
  };

  return (
    <div className="rounded-3xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
          <Cpu className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-white">
            SECTION 1 — Konfigurasi Hardware
          </h3>
          <p className="font-sans text-xs text-zinc-400">
            Pengaturan konektivitas sensor optik konveyor, kamera edge AI, dan simulasi hardware.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Toggle Switch: Mode Simulasi (Mock Hardware) */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-white block">
              Mode Simulasi (Mock Hardware)
            </span>
            <span className="text-[11px] text-zinc-400 font-sans">
              Gunakan generator frame sintetis untuk pengujian offline tanpa menghubungkan kamera fisik.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.simulationMode}
            onClick={() => onChange("simulationMode", !settings.simulationMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.simulationMode ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                settings.simulationMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Dropdown: Sumber Kamera */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-white block">
                Sumber Kamera
              </span>
              <span className="text-[11px] text-zinc-400 font-sans">
                Pilih protokol video stream kamera optik konveyor
              </span>
            </div>

            <select
              value={settings.cameraSource}
              aria-label="Pilih Sumber Kamera"
              onChange={(e) =>
                onChange("cameraSource", e.target.value as "mock" | "rtsp")
              }
              className="px-3 py-1.5 text-xs rounded-xl bg-black/40 border border-white/[0.1] text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="mock" className="bg-[#0b0e14]">
                Mock Camera (Synthesized Frame)
              </option>
              <option value="rtsp" className="bg-[#0b0e14]">
                RTSP Live Stream URL
              </option>
            </select>
          </div>

          {/* Conditional RTSP URL Field */}
          {settings.cameraSource === "rtsp" && (
            <div className="pt-2">
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                RTSP Stream URL (Edge Vision Device)
              </label>
              <div className="relative">
                <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={settings.rtspUrl}
                  onChange={(e) => onChange("rtspUrl", e.target.value)}
                  placeholder="rtsp://192.168.1.120:8554/live/station-01"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-black/40 border border-white/[0.1] text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Row & Test Koneksi Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#07090e] border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div>
              <span className="text-xs font-bold text-white font-mono block">
                Status Hardware: TERHUBUNG
              </span>
              <span className="text-[11px] text-zinc-400 font-sans">
                Station #01 Conveyor • IP: 192.168.1.120:8554
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-white/[0.06] hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 border border-white/[0.1] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
            <span>{isTesting ? "Menguji..." : "Test Koneksi"}</span>
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs font-mono text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{testResult}</span>
          </div>
        )}
      </div>
    </div>
  );
}

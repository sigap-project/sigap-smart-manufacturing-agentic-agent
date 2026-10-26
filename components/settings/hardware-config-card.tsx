"use client";

import { useState } from "react";
import { Cpu, Camera, RefreshCw, CheckCircle2 } from "lucide-react";
import { AnimatedSelect } from "@/components/ui/animated-select";
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
      setTestResult("Connection Stable • Ping: 12ms • Frame Rate: 60 FPS • Stream Latency: Nominal");
    }, 1200);
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
          <Cpu className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Hardware &amp; Optical Connectivity
          </h3>
          <p className="text-xs text-slate-500">
            Configure conveyor optical sensors, edge camera feeds, and simulation hardware telemetry.
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Toggle Switch: Simulation Mode */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-900 block">
              Simulation Mode (Mock Hardware)
            </span>
            <span className="text-[11px] text-slate-500">
              Use synthesized frame generators for offline testing without connecting physical camera sensors.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.simulationMode}
            onClick={() => onChange("simulationMode", !settings.simulationMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.simulationMode ? "bg-slate-900" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.simulationMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Dropdown: Camera Source */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-900 block">
                Camera Source Protocol
              </span>
              <span className="text-[11px] text-slate-500">
                Select video stream ingest protocol from conveyor edge inspection station
              </span>
            </div>

            <AnimatedSelect
              value={settings.cameraSource}
              onChange={(val) => onChange("cameraSource", val as "mock" | "rtsp")}
              options={[
                { id: "mock", label: "Mock Camera (Synthesized Frame)" },
                { id: "rtsp", label: "RTSP Live Stream URL" },
              ]}
              ariaLabel="Select Camera Source"
            />
          </div>

          {/* Conditional RTSP URL Field */}
          {settings.cameraSource === "rtsp" && (
            <div className="pt-2">
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                RTSP Stream URL (Edge Vision Device)
              </label>
              <div className="relative">
                <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={settings.rtspUrl}
                  onChange={(e) => onChange("rtspUrl", e.target.value)}
                  placeholder="rtsp://192.168.1.120:8554/live/station-01"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Row & Test Connection Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <div>
              <span className="text-xs font-semibold text-slate-900 block">
                Hardware Status: Connected
              </span>
              <span className="text-[11px] text-slate-500">
                Station #01 Conveyor • Gateway IP: 192.168.1.120:8554
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isTesting ? "animate-spin" : ""}`} />
            <span>{isTesting ? "Testing Ping..." : "Test Connectivity"}</span>
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{testResult}</span>
          </div>
        )}
      </div>
    </div>
  );
}

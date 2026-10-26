"use client";

import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Scan,
  Pause,
} from "lucide-react";

interface TwinControlRailProps {
  currentState: "idle" | "scanning" | "ok" | "defect";
  onSelectState: (state: "idle" | "scanning" | "ok" | "defect") => void;
  showBadges: boolean;
  onToggleBadges: () => void;
  isLiveSSE: boolean;
  onToggleLiveSSE: () => void;
  isConnected: boolean;
  className?: string;
}

export function TwinControlRail({
  currentState,
  onSelectState,
  showBadges,
  onToggleBadges,
  isLiveSSE,
  onToggleLiveSSE,
  isConnected,
  className,
}: TwinControlRailProps) {
  return (
    <div
      className={
        className ??
        "flex items-center gap-1.5 p-1 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.03)] pointer-events-auto select-none"
      }
    >
      {/* 1. Live SSE Mode Toggle Pill */}
      <button
        type="button"
        onClick={onToggleLiveSSE}
        title={isLiveSSE ? "Live Real-Time SSE Active (Click for Manual Mode)" : "Manual Simulation Mode (Click to Activate Live SSE)"}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
          isLiveSSE
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
            : "bg-slate-100 text-slate-500 hover:text-slate-800 border border-transparent"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isLiveSSE && isConnected ? "bg-emerald-500" : "bg-slate-400"
          }`}
        />
        <span>{isLiveSSE ? "Live SSE" : "Manual"}</span>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200" />

      {/* 2. Horizontal State Switcher Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          id="btn-control-idle"
          onClick={() => onSelectState("idle")}
          title="Shortcut [1]: Idle / Standby at AI Station"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            currentState === "idle"
              ? "bg-slate-900 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Pause className="w-3 h-3" />
          <span>1. Idle</span>
        </button>

        <button
          type="button"
          id="btn-control-scan"
          onClick={() => onSelectState("scanning")}
          title="Shortcut [2]: Optical Inspection Scan at Conveyor"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            currentState === "scanning"
              ? "bg-slate-900 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Scan className="w-3 h-3" />
          <span>2. Scan</span>
        </button>

        <button
          type="button"
          id="btn-control-ok"
          onClick={() => onSelectState("ok")}
          title="Shortcut [3]: OK Pass at Release Container"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            currentState === "ok"
              ? "bg-emerald-600 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>3. OK Pass</span>
        </button>

        <button
          type="button"
          id="btn-control-defect"
          onClick={() => onSelectState("defect")}
          title="Shortcut [4]: Defect Alert at Quarantine Container"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            currentState === "defect"
              ? "bg-rose-600 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>4. Defect</span>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200" />

      {/* 3. Toggle Badges Button */}
      <button
        type="button"
        onClick={onToggleBadges}
        title={showBadges ? "Hide AR Overlay Data Badges" : "Show AR Overlay Data Badges"}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
          showBadges
            ? "bg-slate-100 text-slate-900 font-semibold"
            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        }`}
      >
        <Layers className="w-3 h-3" />
        <span>Labels</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            showBadges ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      </button>
    </div>
  );
}

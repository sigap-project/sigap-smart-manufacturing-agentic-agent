"use client";

import { FileSpreadsheet, HardDrive } from "lucide-react";
import { AnimatedSelect } from "@/components/ui/animated-select";
import { SettingsState } from "./types";

interface ExportLogCardProps {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export function ExportLogCard({ settings, onChange }: ExportLogCardProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
          <FileSpreadsheet className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Data Export &amp; Log Retention
          </h3>
          <p className="text-xs text-slate-500">
            Batch record archiving schedules, shift report exports, and cloud storage lifecycle policies.
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Toggle: Auto-export CSV per shift */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-900 block">
              Auto-Export CSV per Shift
            </span>
            <span className="text-[11px] text-slate-500">
              Automatically deliver summarized CSV reports to the QC Lead and Plant Manager email at each shift handover.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.autoExportCsv}
            onClick={() => onChange("autoExportCsv", !settings.autoExportCsv)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.autoExportCsv ? "bg-slate-900" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.autoExportCsv ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Dropdown: Log Retention Period */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-900">
                Log Retention Period
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              Duration optical frame snapshots and AI inference logs remain in active storage before lifecycle tiering.
            </span>
          </div>

          <AnimatedSelect
            value={settings.logRetention}
            onChange={(val) =>
              onChange("logRetention", val as "7" | "14" | "30")
            }
            options={[
              { id: "7", label: "7 Days (Fast Storage)" },
              { id: "14", label: "14 Days (Standard Shift)" },
              { id: "30", label: "30 Days (ISO 9001 Compliance)" },
            ]}
            ariaLabel="Select Log Retention Period"
          />
        </div>
      </div>
    </div>
  );
}

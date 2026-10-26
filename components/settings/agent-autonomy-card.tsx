"use client";

import { Zap, UserCheck, Clock, Layers } from "lucide-react";
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
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
          <Zap className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Agent Autonomy &amp; Governance Level
          </h3>
          <p className="text-xs text-slate-500">
            Configure the degree of autonomous decision-making for plant dispatch and escalation workflows.
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Toggle 1: Auto-save to Batch Board */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-semibold text-slate-900">
                Auto-record to Batch Board
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              Inspection lot records automatically synchronize to the Batch Board without requiring manual verification.
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
              settings.autoSaveBatchBoard ? "bg-slate-900" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.autoSaveBatchBoard ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Radio Group: Auto-dispatch Mode */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-3">
          <div>
            <span className="text-xs font-semibold text-slate-900 block mb-0.5">
              Auto-Dispatch Mode (ERP Integration)
            </span>
            <p className="text-[11px] text-slate-500">
              Determine whether agent logic independently issues ERP escalation tickets or requires human approval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Option 1: Fully Autonomous */}
            <div
              onClick={() => onChange("autoDispatchMode", "autonomous")}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                settings.autoDispatchMode === "autonomous"
                  ? "bg-white border-slate-900 ring-1 ring-slate-900 shadow-sm"
                  : "bg-white/80 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-900" />
                    <span className="text-xs font-semibold text-slate-900">
                      Fully Autonomous
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Agent automatically issues dispatch tickets to SAP QM, MM, and PP when escalation score exceeds &gt;0.70.
                  </p>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.autoDispatchMode === "autonomous"
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-300"
                  }`}
                >
                  {settings.autoDispatchMode === "autonomous" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>

              <span className="text-[10px] font-medium text-slate-500">
                Autonomous Latency: &lt; 1 Sec
              </span>
            </div>

            {/* Option 2: Human Approval Required */}
            <div
              onClick={() => onChange("autoDispatchMode", "human_approval")}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                settings.autoDispatchMode === "human_approval"
                  ? "bg-white border-slate-900 ring-1 ring-slate-900 shadow-sm"
                  : "bg-white/80 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-900" />
                    <span className="text-xs font-semibold text-slate-900">
                      Human Approval Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    All escalations enter the &ldquo;Pending Approval&rdquo; queue and require sign-off by Shift QC Lead.
                  </p>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.autoDispatchMode === "human_approval"
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-300"
                  }`}
                >
                  {settings.autoDispatchMode === "human_approval" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>

              <span className="text-[10px] font-medium text-slate-500">
                Human-in-the-Loop Active
              </span>
            </div>
          </div>
        </div>

        {/* Stepper Input: Approval SLA Timeout */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              <label className="text-xs font-semibold text-slate-900">
                Approval Timeout (SLA Minutes)
              </label>
            </div>
            <span className="text-[11px] text-slate-500 block">
              Waiting limit for supervisor response before routing secondary escalations to Plant Operations Head.
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
              className="w-20 px-3 py-1.5 text-xs font-semibold text-slate-900 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-center"
            />
            <span className="text-xs text-slate-500">Minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

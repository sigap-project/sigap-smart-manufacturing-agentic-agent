"use client";

import { Sparkles, CheckSquare, Square } from "lucide-react";
import { ALL_PRODUCTS, SettingsState } from "./types";

interface ModelAiConfigCardProps {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export function ModelAiConfigCard({
  settings,
  onChange,
}: ModelAiConfigCardProps) {
  const toggleProduct = (product: string) => {
    const exists = settings.monitoredProducts.includes(product);
    if (exists) {
      onChange(
        "monitoredProducts",
        settings.monitoredProducts.filter((p) => p !== product)
      );
    } else {
      onChange("monitoredProducts", [...settings.monitoredProducts, product]);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
            <Sparkles className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              AI Detection &amp; Escalation Thresholds
            </h3>
            <p className="text-xs text-slate-500">
              Parameters for YOLOv8-Nano inference, AWS Bedrock temporal memory, and monitored product SKUs.
            </p>
          </div>
        </div>

        {/* Model Status Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[11px] text-slate-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Detector: Active</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[11px] text-slate-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Classifier: Active</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Slider 1: Confidence Threshold (50%–95%) */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-900">
              Confidence Detection Threshold
            </label>
            <span className="text-xs font-semibold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-sm tabular-nums">
              {settings.confidenceThreshold}%
            </span>
          </div>

          <input
            type="range"
            min="50"
            max="95"
            step="1"
            value={settings.confidenceThreshold}
            onChange={(e) =>
              onChange("confidenceThreshold", parseInt(e.target.value))
            }
            className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>High Sensitivity (50%)</span>
            <span>Recommended (85%)</span>
            <span>High Precision (95%)</span>
          </div>
        </div>

        {/* Grid: Temporal Window & Escalation Trigger Count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Slider 2: Escalation Temporal Window */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900">
                Escalation Memory Window
              </label>
              <span className="text-xs font-semibold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm tabular-nums">
                {settings.escalationWindow} Minutes
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Temporal span for Bedrock memory to correlate repetitive defect patterns
            </p>
            <input
              type="range"
              min="2"
              max="30"
              step="1"
              value={settings.escalationWindow}
              onChange={(e) =>
                onChange("escalationWindow", parseInt(e.target.value))
              }
              className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg mt-1"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>2 Min</span>
              <span>30 Min</span>
            </div>
          </div>

          {/* Stepper Input: Consecutive Defect Trigger Count */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between">
            <div>
              <label className="text-xs font-semibold text-slate-900 block mb-0.5">
                Consecutive Trigger Count
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                Frequency threshold that escalates recurrent defects to Level 3 quarantine
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="number"
                min="1"
                max="10"
                value={settings.triggerCount}
                onChange={(e) =>
                  onChange("triggerCount", parseInt(e.target.value) || 1)
                }
                className="w-20 px-3 py-1.5 text-xs font-semibold text-slate-900 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-center"
              />
              <span className="text-xs text-slate-500">
                Consecutive Anomalies
              </span>
            </div>
          </div>
        </div>

        {/* Checkbox Chips: Monitored Products */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-900 block">
              Active Monitored Product SKUs
            </label>
            <p className="text-[11px] text-slate-500">
              Select manufactured parts actively routed through real-time optical validation
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_PRODUCTS.map((prod) => {
              const isChecked = settings.monitoredProducts.includes(prod);
              return (
                <button
                  key={prod}
                  type="button"
                  onClick={() => toggleProduct(prod)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium text-left transition-all border cursor-pointer ${
                    isChecked
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm font-semibold"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-white shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{prod}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

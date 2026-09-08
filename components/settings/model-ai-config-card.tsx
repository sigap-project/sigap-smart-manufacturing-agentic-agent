"use client";

import { Sparkles, Sliders, CheckSquare, Square, Layers, ShieldCheck } from "lucide-react";
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
    <div className="rounded-3xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-white">
              SECTION 2 — Konfigurasi Model AI
            </h3>
            <p className="font-sans text-xs text-zinc-400">
              Parameter deteksi YOLOv8-Nano, memori temporal Bedrock, dan produk yang dimonitor.
            </p>
          </div>
        </div>

        {/* Two Small Status Badges Showing Model Load State */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 font-mono text-[10px] text-emerald-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Detector: Loaded</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 font-mono text-[10px] text-cyan-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Classifier: Loaded</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Slider 1: Ambang Kepercayaan Deteksi (50%–95%) */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white">
              Ambang Kepercayaan Deteksi (Confidence Threshold)
            </label>
            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
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
            className="w-full accent-emerald-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Sensitif (50%)</span>
            <span>Rekomendasi (85%)</span>
            <span>Presisi Tinggi (95%)</span>
          </div>
        </div>

        {/* Grid: Jendela Waktu & Jumlah Kejadian Pemicu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Slider 2: Jendela Waktu Eskalasi (2–30 menit) */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white">
                Jendela Waktu Eskalasi
              </label>
              <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {settings.escalationWindow} Menit
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans">
              Rentang temporal analisis memori untuk mendeteksi anomali berulang
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
              className="w-full accent-cyan-500 cursor-pointer h-2 bg-zinc-800 rounded-lg mt-1"
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span>2 Menit</span>
              <span>30 Menit</span>
            </div>
          </div>

          {/* Number Input: Jumlah Kejadian Pemicu Eskalasi */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
            <div>
              <label className="text-xs font-semibold text-white block mb-1">
                Jumlah Kejadian Pemicu Eskalasi
              </label>
              <p className="text-[11px] text-zinc-400 font-sans mb-3">
                Ambang frekuensi kejadian cacat yang memicu auto-escalation ke Level 3
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10"
                value={settings.triggerCount}
                onChange={(e) =>
                  onChange("triggerCount", parseInt(e.target.value) || 1)
                }
                className="w-24 px-3 py-2 text-xs font-mono font-bold text-white rounded-xl bg-black/40 border border-white/[0.1] focus:outline-none focus:border-emerald-500/50 text-center"
              />
              <span className="text-xs font-mono text-zinc-400">
                Kejadian Cacat Berulang
              </span>
            </div>
          </div>
        </div>

        {/* Checkbox Group: Tipe Produk yang Dimonitor */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
          <label className="text-xs font-semibold text-white block">
            Tipe Produk yang Dimonitor (Active Product Types)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {ALL_PRODUCTS.map((prod) => {
              const isChecked = settings.monitoredProducts.includes(prod);
              return (
                <button
                  key={prod}
                  type="button"
                  onClick={() => toggleProduct(prod)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-mono text-left transition-all border cursor-pointer ${
                    isChecked
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold"
                      : "bg-black/20 border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600 shrink-0" />
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

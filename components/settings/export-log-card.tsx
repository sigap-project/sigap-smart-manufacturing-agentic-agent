"use client";

import { FileSpreadsheet, HardDrive, Calendar, Database } from "lucide-react";
import { SettingsState } from "./types";

interface ExportLogCardProps {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export function ExportLogCard({ settings, onChange }: ExportLogCardProps) {
  return (
    <div className="rounded-3xl bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl p-5 sm:p-6 space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
        <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/25">
          <FileSpreadsheet className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-white">
            SECTION 4 — Export &amp; Log
          </h3>
          <p className="font-sans text-xs text-zinc-400">
            Otomatisasi pengarsipan data batch, ekspor laporan berkala, dan retensi penyimpanan AWS S3.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Toggle: Auto-export CSV per shift */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-white block">
              Auto-export CSV per shift
            </span>
            <span className="text-[11px] text-zinc-400 font-sans">
              Otomatis kirim rekap file CSV riwayat inspeksi ke email QC Lead &amp; Plant Manager di setiap akhir shift kerja.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.autoExportCsv}
            onClick={() => onChange("autoExportCsv", !settings.autoExportCsv)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.autoExportCsv ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                settings.autoExportCsv ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Dropdown: Periode Retensi Log */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-semibold text-white">
                Periode Retensi Log
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-sans block">
              Lama penyimpanan frame snapshot kamera dan log penalaran AI di AWS S3 sebelum diarsipkan ke cold storage Glacier.
            </span>
          </div>

          <select
            value={settings.logRetention}
            aria-label="Pilih Periode Retensi Log"
            onChange={(e) =>
              onChange("logRetention", e.target.value as "7" | "14" | "30")
            }
            className="px-4 py-2 text-xs font-mono font-medium rounded-xl bg-black/40 border border-white/[0.1] text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer shrink-0"
          >
            <option value="7" className="bg-[#0b0e14]">
              7 Hari (Penyimpanan Cepat)
            </option>
            <option value="14" className="bg-[#0b0e14]">
              14 Hari (Standar Shift)
            </option>
            <option value="30" className="bg-[#0b0e14]">
              30 Hari (Audit ISO 9001:2015)
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}

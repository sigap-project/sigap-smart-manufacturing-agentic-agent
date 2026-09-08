"use client";

import { RotateCcw, Check, Save } from "lucide-react";

interface SettingsActionBarProps {
  onReset: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function SettingsActionBar({
  onReset,
  onSave,
  isSaving,
}: SettingsActionBarProps) {
  return (
    <div className="sticky bottom-4 z-30 p-4 rounded-2xl bg-[#07090e]/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-black/80 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
      <div className="text-[11px] font-mono text-zinc-400 hidden sm:block">
        Perubahan parameter langsung disinkronkan ke agent runtime lokal.
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        {/* Reset ke Default (Outline Button) */}
        <button
          type="button"
          onClick={onReset}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-semibold text-zinc-300 hover:text-white border border-white/[0.12] hover:bg-white/[0.06] transition-all cursor-pointer shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset ke Default</span>
        </button>

        {/* Simpan Pengaturan (Solid Primary Button) */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4 stroke-[2.5]" />
          )}
          <span>{isSaving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
        </button>
      </div>
    </div>
  );
}

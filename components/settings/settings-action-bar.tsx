"use client";

import { motion } from "framer-motion";
import { RotateCcw, Save } from "lucide-react";

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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.66, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
      className="sticky bottom-4 z-30 p-3.5 sm:p-4 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <div className="text-xs text-slate-500 hidden sm:block">
        Parameter updates synchronize immediately to active agent runtime.
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {/* Reset to Factory Defaults */}
        <button
          type="button"
          onClick={onReset}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset to Defaults</span>
        </button>

        {/* Save Changes (FlowDesk Dark Primary Button) */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{isSaving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>
    </motion.div>
  );
}

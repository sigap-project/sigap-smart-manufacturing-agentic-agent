"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { HardwareConfigCard } from "@/components/settings/hardware-config-card";
import { ModelAiConfigCard } from "@/components/settings/model-ai-config-card";
import { AgentAutonomyCard } from "@/components/settings/agent-autonomy-card";
import { ExportLogCard } from "@/components/settings/export-log-card";
import { SettingsActionBar } from "@/components/settings/settings-action-bar";
import { SettingsSkeleton } from "@/components/settings/settings-skeleton";
import { DEFAULT_SETTINGS, SettingsState } from "@/components/settings/types";
import { useSigapGlobal } from "@/context/sigap-global-context";

export default function SettingsPage() {
  const { settings: globalSettings, saveSettings: globalSaveSettings } = useSigapGlobal();
  const [settings, setSettings] = useState<SettingsState>(globalSettings || DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (globalSettings) {
      setSettings(globalSettings);
    }
  }, [globalSettings]);

  // Ambil pengaturan nyata dari database PostgreSQL melalui API
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.data) {
          setSettings(json.data);
          try {
            localStorage.setItem("sigap_system_settings", JSON.stringify(json.data));
          } catch {}
          return;
        }
      } catch (err) {
        console.warn("Failed fetching settings from server, falling back to cache:", err);
      } finally {
        setIsLoading(false);
      }

      try {
        const saved = localStorage.getItem("sigap_system_settings");
        if (saved) {
          setSettings(JSON.parse(saved));
        }
      } catch {
        // Fallback to default
      }
    }
    fetchSettings();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleFieldChange = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Simpan perubahan ke PostgreSQL melalui PUT /api/settings
  const handleSave = async () => {
    setIsSaving(true);
    globalSaveSettings(settings);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.data) {
        setSettings(json.data);
      }
      try {
        localStorage.setItem("sigap_system_settings", JSON.stringify(settings));
      } catch {}
      showToast(json.message || "All system parameters saved successfully to PostgreSQL database.");
    } catch {
      try {
        localStorage.setItem("sigap_system_settings", JSON.stringify(settings));
      } catch {}
      showToast("Saved locally (offline fallback mode).");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset ke konfigurasi default pabrik di database
  const handleReset = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_SETTINGS),
      });
      const json = await res.json();
      if (json.data) {
        setSettings(json.data);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      try {
        localStorage.removeItem("sigap_system_settings");
      } catch {}
      showToast("System settings restored to factory defaults.");
    } catch {
      setSettings(DEFAULT_SETTINGS);
      showToast("System settings restored to factory defaults.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-16 animate-in fade-in duration-200">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Context Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              System Settings &amp; Calibration
            </h1>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Runtime Sync Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Configure optical sensor inputs, defect inference thresholds, agent autonomy levels, and audit log retention.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs text-slate-600">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Loading...</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="text-slate-400">Database:</span>
            <span className="text-slate-800 font-semibold">PostgreSQL Sync</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="text-slate-400">Firmware:</span>
            <span className="text-slate-800 font-semibold">v2.4.1</span>
          </div>
        </div>
      </motion.div>

      {/* SECTION 1: Hardware & Optical Connectivity */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
      >
        <HardwareConfigCard
          settings={settings}
          onChange={handleFieldChange}
        />
      </motion.div>

      {/* SECTION 2: AI Detection & Escalation Thresholds */}
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.30, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
      >
        <ModelAiConfigCard
          settings={settings}
          onChange={handleFieldChange}
        />
      </motion.div>

      {/* SECTION 3: Agent Autonomy & Governance Level */}
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
      >
        <AgentAutonomyCard
          settings={settings}
          onChange={handleFieldChange}
        />
      </motion.div>

      {/* SECTION 4: Data Export & Log Retention */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.54, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
      >
        <ExportLogCard
          settings={settings}
          onChange={handleFieldChange}
        />
      </motion.div>

      {/* BOTTOM FLOATING ACTION BAR: Save Changes & Reset to Defaults */}
      <SettingsActionBar
        isSaving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Settings, CheckCircle2, RotateCcw, Sliders, ShieldCheck, Loader2 } from "lucide-react";
import { HardwareConfigCard } from "@/components/settings/hardware-config-card";
import { ModelAiConfigCard } from "@/components/settings/model-ai-config-card";
import { AgentAutonomyCard } from "@/components/settings/agent-autonomy-card";
import { ExportLogCard } from "@/components/settings/export-log-card";
import { SettingsActionBar } from "@/components/settings/settings-action-bar";
import { SettingsSkeleton } from "@/components/settings/settings-skeleton";
import { DEFAULT_SETTINGS, SettingsState } from "@/components/settings/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        console.warn("Gagal mengambil pengaturan dari server, menggunakan cache lokal:", err);
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
      showToast(json.message || "Seluruh pengaturan sistem berhasil disimpan ke database PostgreSQL.");
    } catch {
      try {
        localStorage.setItem("sigap_system_settings", JSON.stringify(settings));
      } catch {}
      showToast("Tersimpan secara lokal (offline fallback).");
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
      showToast("Pengaturan dikembalikan ke konfigurasi default pabrik di database.");
    } catch {
      setSettings(DEFAULT_SETTINGS);
      showToast("Pengaturan dikembalikan ke konfigurasi default pabrik.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-16">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-zinc-950/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-2xl backdrop-blur-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Pengaturan Sistem &amp; Kalibrasi AI
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              RUNTIME SYNC ACTIVE
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            Pusat konfigurasi hardware optik, parameter inferensi deteksi cacat, level otonomi agentic, dan retensi log.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono text-zinc-400">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Memuat...</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Database:</span>
            <span className="text-emerald-400 font-bold">PostgreSQL Sync</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Firmware:</span>
            <span className="text-emerald-400 font-bold">v2.4.1-Production</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Konfigurasi Hardware (Mock Mode, Kamera RTSP, Status Koneksi) */}
      <HardwareConfigCard
        settings={settings}
        onChange={handleFieldChange}
      />

      {/* SECTION 2: Konfigurasi Model AI (Confidence Threshold, Escalation Window, Monitored Products) */}
      <ModelAiConfigCard
        settings={settings}
        onChange={handleFieldChange}
      />

      {/* SECTION 3: Level Otonomi Agent (Visually Emphasized with accent left border) */}
      <AgentAutonomyCard
        settings={settings}
        onChange={handleFieldChange}
      />

      {/* SECTION 4: Ekspor & Retensi Log (Auto CSV, Log Retention Period) */}
      <ExportLogCard
        settings={settings}
        onChange={handleFieldChange}
      />

      {/* BOTTOM FLOATING ACTION BAR: Simpan Perubahan & Reset Default */}
      <SettingsActionBar
        isSaving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  );
}

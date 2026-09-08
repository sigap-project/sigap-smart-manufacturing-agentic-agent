"use client";

import { useState } from "react";
import {
  Send,
  Package,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Radio,
} from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

interface ActivityItem {
  id?: string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  status: string;
  badgeColor: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  isNew?: boolean;
}

const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    title: "SAP QM Quality Notification Diterbitkan",
    description: "Tiket #QN-9042 diterbitkan otonom untuk Lot #B-2026-0730 beserta foto S3",
    source: "Station #01 • YOLOv8",
    timestamp: "2 mnt lalu",
    status: "Dispatched",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: Send,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/25",
  },
  {
    title: "Flag 'UnderReview' pada Vendor Scrap",
    description: "PATCH /SupplierRecord/{id} ke SAP MM untuk vendor PT Krakatau Scrap",
    source: "AWS Bedrock Agent",
    timestamp: "8 mnt lalu",
    status: "Held",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Package,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/25",
  },
  {
    title: "Diverter Pneumatik Mengalihkan Batch",
    description: "45 pcs kubus casting anomali dialihkan ke Bin Karantina Fisik (skor 0.74)",
    source: "PLC S7-1200",
    timestamp: "14 mnt lalu",
    status: "Quarantined",
    badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    icon: AlertTriangle,
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/25",
  },
  {
    title: "Usulan Reschedule Lini Cetak SAP PP",
    description: "POST /RescheduleRequest diajukan untuk optimasi furnace peleburan logam",
    source: "SAP PP Connector",
    timestamp: "25 mnt lalu",
    status: "Pending Approval",
    badgeColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    icon: CalendarClock,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10 border-cyan-500/25",
  },
  {
    title: "Threshold Confidence Vision Dikalibrasi",
    description: "YOLOv8-Nano auto-tuning threshold ke 94.2% untuk mereduksi false-positive",
    source: "Agentic Vision Core",
    timestamp: "40 mnt lalu",
    status: "Completed",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/25",
  },
];

export function DashboardRecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);

  // Dengarkan seluruh event operasional SIGAP melalui SSE
  const { isConnected } = useSigapEvents({
    onInspectionCreated: (newIns) => {
      const isDefect = newIns.defectDetected ?? (newIns.defectClass !== "OK");
      const newItem: ActivityItem = {
        id: `act-${Date.now()}`,
        title: isDefect
          ? `Anomali Terdeteksi: ${newIns.defectClass}`
          : `Unit Lolos Inspeksi: ${newIns.partName || "Bracket Motor"}`,
        description: `Frame #${String(newIns.id).slice(-4)} (${newIns.confidence}% confidence) terinspeksi pada ${newIns.batchId || "Lot Aktif"}`,
        source: "Station #01 • YOLOv8-Nano",
        timestamp: "Baru saja",
        status: isDefect ? "Held" : "Passed",
        badgeColor: isDefect
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        icon: isDefect ? AlertTriangle : CheckCircle2,
        iconColor: isDefect ? "text-amber-400" : "text-emerald-400",
        iconBg: isDefect
          ? "bg-amber-500/10 border-amber-500/25"
          : "bg-emerald-500/10 border-emerald-500/25",
        isNew: true,
      };

      setActivities((prev) => [newItem, ...prev.slice(0, 4)]);
    },
    onDispatchStatusChanged: (dispatch) => {
      const newItem: ActivityItem = {
        id: `act-${Date.now()}`,
        title: `Tiket ${dispatch.consumer} ${dispatch.status}`,
        description: `${dispatch.id}: ${dispatch.triggerReason || "Sinkronisasi otomatis ke SAP ERP"}`,
        source: "Agentic Dispatch Gateway",
        timestamp: "Baru saja",
        status: dispatch.status,
        badgeColor:
          dispatch.status === "Dispatched"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-amber-500/15 text-amber-400 border-amber-500/30",
        icon: Send,
        iconColor: dispatch.status === "Dispatched" ? "text-emerald-400" : "text-amber-400",
        iconBg:
          dispatch.status === "Dispatched"
            ? "bg-emerald-500/10 border-emerald-500/25"
            : "bg-amber-500/10 border-amber-500/25",
        isNew: true,
      };

      setActivities((prev) => [newItem, ...prev.slice(0, 4)]);
    },
    onBatchStatusChanged: (batch) => {
      const isReleased = batch.status === "released";
      const isRejected = batch.status === "rejected";
      const newItem: ActivityItem = {
        id: `act-${Date.now()}`,
        title: `Batch ${batch.lotId} Status: ${String(batch.status).toUpperCase()}`,
        description: `Pembaruan siklus lot manufaktur (${batch.defectCount || 0} anomali terhitung)`,
        source: "Batch Lifecycle Engine",
        timestamp: "Baru saja",
        status: isReleased ? "Released" : isRejected ? "Quarantined" : "Held",
        badgeColor: isReleased
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : isRejected
          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
          : "bg-amber-500/15 text-amber-400 border-amber-500/30",
        icon: Package,
        iconColor: isReleased
          ? "text-emerald-400"
          : isRejected
          ? "text-rose-400"
          : "text-amber-400",
        iconBg: isReleased
          ? "bg-emerald-500/10 border-emerald-500/25"
          : isRejected
          ? "bg-rose-500/10 border-rose-500/25"
          : "bg-amber-500/10 border-amber-500/25",
        isNew: true,
      };

      setActivities((prev) => [newItem, ...prev.slice(0, 4)]);
    },
  });

  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
              Aktivitas Agent Terbaru
            </h3>
            <span
              className={`font-mono text-[9px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                isConnected
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              {isConnected ? "LIVE STREAM" : "CONNECTING..."}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Log tindakan otonom AWS Bedrock ke lini fisik &amp; SAP ERP
          </p>
        </div>

        <button
          aria-label="Lihat Semua Log"
          className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Buka Log Lengkap"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {activities.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id || idx}
              className={`p-3.5 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                item.isNew
                  ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
                  : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.10]"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2 rounded-xl border shrink-0 mt-0.5 sm:mt-0 ${item.iconBg}`}
                >
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {item.title}
                  </span>
                  <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-zinc-500">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex sm:justify-end">
                <span
                  className={`font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full border ${item.badgeColor}`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


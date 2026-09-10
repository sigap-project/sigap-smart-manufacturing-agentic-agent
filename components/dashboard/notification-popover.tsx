"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  Send,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "escalation" | "quarantine" | "sap" | "approval" | "system";
  read: boolean;
  href?: string;
  lotId?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Eskalasi Level 3 Otomatis",
    message: "Pola anomali cacat berulang terdeteksi pada Lot #B-2026-0730. Tiket QM-2026-9912 otomatis dikirim ke SAP QM.",
    timestamp: "3 mnt lalu",
    type: "escalation",
    read: false,
    href: "/dashboard/inspection",
    lotId: "#B-2026-0730",
  },
  {
    id: "notif-2",
    title: "Isolasi Zona Karantina",
    message: "Lot #B-2026-0726 (Exhaust Manifold K3) dialihkan ke Zona Karantina karena skor eskalasi melampaui 0.70.",
    timestamp: "18 mnt lalu",
    type: "quarantine",
    read: false,
    href: "/dashboard/batches",
    lotId: "#B-2026-0726",
  },
  {
    id: "notif-3",
    title: "Flag Vendor SAP MM UnderReview",
    message: "Supplier PT Krakatau Scrap Ind. diberi penandaan evaluasi kualitas otomatis pada Purchase Order aktif.",
    timestamp: "42 mnt lalu",
    type: "sap",
    read: false,
    href: "/dashboard/dispatch",
  },
  {
    id: "notif-4",
    title: "Pelepasan Batch Disetujui",
    message: "Supervisor menyetujui pelepasan Lot #B-2026-0729 untuk perakitan komponen lini utama.",
    timestamp: "1 jam lalu",
    type: "approval",
    read: true,
    href: "/dashboard/batches",
    lotId: "#B-2026-0729",
  },
];

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Dengarkan event live melalui Server-Sent Events (SSE)
  useSigapEvents({
    onInspectionCreated: (newIns) => {
      const isDefect =
        newIns.defectDetected ??
        (newIns.defectClass?.toLowerCase() !== "ok");

      if (isDefect) {
        const newNotif: NotificationItem = {
          id: `live-ins-${Date.now()}`,
          title: "Anomali Baru Terdeteksi",
          message: `Frame inspeksi mendeteksi cacat pada lot ${newIns.batchId || "#B-2026-0730"} (Confidence: ${newIns.confidence ?? 95}%).`,
          timestamp: "Baru saja",
          type: "escalation",
          read: false,
          href: "/dashboard/inspection",
          lotId: newIns.batchId || "#B-2026-0730",
        };
        setNotifications((prev) => [newNotif, ...prev]);
      }
    },
    onBatchStatusChanged: (data) => {
      const newNotif: NotificationItem = {
        id: `live-batch-${Date.now()}`,
        title: "Pembaruan Status Batch",
        message: `Batch ${data.lotId || data.id} kini berstatus ${data.status.toUpperCase()}.`,
        timestamp: "Baru saja",
        type: data.status === "held" ? "quarantine" : "approval",
        read: false,
        href: "/dashboard/batches",
        lotId: data.lotId || data.id,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    },
    onDispatchStatusChanged: (data) => {
      const newNotif: NotificationItem = {
        id: `live-disp-${Date.now()}`,
        title: "Disposisi SAP ERP Terkirim",
        message: `Tiket ${data.sapTicketId || data.id} berhasil dikomunikasikan ke modul ${data.consumer || "SAP QM"}.`,
        timestamp: "Baru saja",
        type: "sap",
        read: false,
        href: "/dashboard/dispatch",
      };
      setNotifications((prev) => [newNotif, ...prev]);
    },
  });

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const getNotificationIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "escalation":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case "quarantine":
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      case "sap":
        return <Send className="w-4 h-4 text-cyan-400 shrink-0" />;
      case "approval":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
  };

  const getBadgeStyle = (type: NotificationItem["type"]) => {
    switch (type) {
      case "escalation":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      case "quarantine":
        return "bg-rose-500/10 text-rose-300 border-rose-500/30";
      case "sap":
        return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
      case "approval":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
      default:
        return "bg-white/[0.05] text-zinc-400 border-white/10";
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Lihat Notifikasi"
        aria-expanded={isOpen}
        className={`relative p-2 rounded-xl transition-all cursor-pointer ${
          isOpen
            ? "bg-white/[0.10] text-white ring-1 ring-white/20"
            : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
        }`}
        title={`${unreadCount} Notifikasi Belum Dibaca`}
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-mono font-bold text-zinc-950 shadow-md shadow-emerald-500/40 animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu Container */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl bg-[#090c12]/95 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-display text-xs sm:text-sm font-bold text-white tracking-tight">
                  Notifikasi Manufaktur
                </h4>
                <p className="text-[10px] font-mono text-zinc-400">
                  {unreadCount} belum dibaca • Telemetri Agen SIGAP
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Tandai semua notifikasi sudah dibaca"
              >
                <CheckCheck className="w-3 h-3 text-emerald-400" />
                <span>Baca Semua</span>
              </button>
            )}
          </div>

          {/* List Notifications */}
          <div
            className="max-h-[360px] overflow-y-auto divide-y divide-white/[0.04] overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
            onWheel={(e) => e.stopPropagation()}
          >
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-zinc-400 font-sans">
                  Belum ada notifikasi operasional baru.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3 sm:p-3.5 transition-colors group cursor-pointer ${
                    notif.read
                      ? "bg-transparent hover:bg-white/[0.02]"
                      : "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`text-xs font-semibold truncate ${
                              notif.read ? "text-zinc-300" : "text-white font-bold"
                            }`}
                          >
                            {notif.title}
                          </span>
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {notif.timestamp}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 leading-relaxed font-sans line-clamp-2 mb-2">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        {notif.lotId ? (
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                            {notif.lotId}
                          </span>
                        ) : (
                          <span
                            className={`font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase ${getBadgeStyle(
                              notif.type
                            )}`}
                          >
                            {notif.type}
                          </span>
                        )}

                        {notif.href && (
                          <Link
                            href={notif.href}
                            onClick={() => {
                              markAsRead(notif.id);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <span>Buka</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Navigation */}
          <div className="p-2.5 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono">
            <span className="text-zinc-500">SIGAP Event Relay</span>
            <Link
              href="/dashboard/dispatch"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>Semua Log Disposisi ERP</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

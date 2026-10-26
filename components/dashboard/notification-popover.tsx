"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { useSigapGlobal } from "@/context/sigap-global-context";

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

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useSigapGlobal();

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

  const markAllAsRead = markAllNotificationsAsRead;
  const markAsRead = markNotificationAsRead;

  const getNotificationIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "escalation":
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
      case "quarantine":
        return <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />;
      case "sap":
        return <Send className="w-4 h-4 text-blue-600 shrink-0" />;
      case "approval":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  const getNotificationIconContainer = (type: NotificationItem["type"]) => {
    switch (type) {
      case "escalation":
        return "bg-amber-50 border-amber-200/80";
      case "quarantine":
        return "bg-rose-50 border-rose-200/80";
      case "sap":
        return "bg-blue-50 border-blue-200/80";
      case "approval":
        return "bg-emerald-50 border-emerald-200/80";
      default:
        return "bg-slate-100 border-slate-200/80";
    }
  };

  const getBadgeStyle = (type: NotificationItem["type"]) => {
    switch (type) {
      case "escalation":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "quarantine":
        return "bg-rose-50 text-rose-700 border-rose-200/60";
      case "sap":
        return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "approval":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200/80";
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button with high-contrast active state (never blends with white navbar) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Lihat Notifikasi"
        aria-expanded={isOpen}
        className={`relative p-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
          isOpen
            ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/15"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200/60"
        }`}
        title={`${unreadCount} Notifikasi Belum Dibaca`}
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        {unreadCount > 0 && (
          <span
            className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-mono font-bold shadow-xs transition-colors ${
              isOpen
                ? "bg-emerald-500 text-slate-950 ring-2 ring-slate-900"
                : "bg-emerald-500 text-slate-950 ring-2 ring-white"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu Container with Open & Close Animations */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity", transformOrigin: "top right" }}
            className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.12)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-sans text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">
                    Notifikasi Manufaktur
                  </h4>
                  <p className="text-[10px] font-mono text-slate-500">
                    {unreadCount} belum dibaca • Telemetri Agen SIGAP
                  </p>
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  title="Tandai semua notifikasi sudah dibaca"
                >
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  <span>Baca Semua</span>
                </button>
              )}
            </div>

            {/* List Notifications */}
            <div
              className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
              onWheel={(e) => e.stopPropagation()}
            >
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-slate-500 font-sans">
                    Belum ada notifikasi operasional baru.
                  </p>
                </div>
              ) : (
                notifications.map((notif, idx) => (
                  <motion.div
                    key={notif.id || `notif-${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      delay: idx * 0.045,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ willChange: "transform, opacity" }}
                    onClick={() => markAsRead(notif.id)}
                    className={`p-3 sm:p-3.5 transition-colors group cursor-pointer ${
                      notif.read
                        ? "bg-white hover:bg-slate-50/80"
                        : "bg-emerald-50/35 hover:bg-emerald-50/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 p-1.5 rounded-xl border shrink-0 ${getNotificationIconContainer(
                          notif.type
                        )}`}
                      >
                        {getNotificationIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`text-xs truncate ${
                                notif.read ? "text-slate-700 font-medium" : "text-slate-900 font-bold"
                              }`}
                            >
                              {notif.title}
                            </span>
                            {!notif.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {notif.timestamp}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed font-sans line-clamp-2 mb-2">
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          {notif.lotId ? (
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
                              {notif.lotId}
                            </span>
                          ) : (
                            <span
                              className={`font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase font-medium ${getBadgeStyle(
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
                              className="flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                            >
                              <span>Buka</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer Navigation */}
            <div className="p-2.5 px-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-500">SIGAP Event Relay</span>
              <Link
                href="/dashboard/dispatch"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
              >
                <span>Semua Log Disposisi ERP</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

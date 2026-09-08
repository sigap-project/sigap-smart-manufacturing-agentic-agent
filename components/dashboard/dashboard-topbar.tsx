"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  ChevronDown,
  Radio,
  Bell,
  Settings,
  Factory,
  CheckCircle2,
} from "lucide-react";

interface DashboardTopbarProps {
  plantName?: string;
  lineName?: string;
  onToggleMobileMenu?: () => void;
}

export function DashboardTopbar({
  plantName = "PT Logam Presisi Nusantara",
  lineName = "Line #02 • High-Pressure Die Casting",
  onToggleMobileMenu,
}: DashboardTopbarProps) {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#07090e]/85 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 flex items-center justify-between select-none">
      {/* Left: Mobile Hamburger + Current Plant/Line Context Selector */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Buka Menu"
            className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Plant & Line Context Dropdown / Affordance */}
        <button
          className="group flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all text-left cursor-pointer"
          title="Ganti Lokasi Pabrik atau Lini Produksi"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Factory className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                {plantName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform group-hover:translate-y-0.5" />
            </div>
            <span className="font-mono text-[10px] text-zinc-400">
              {lineName}
            </span>
          </div>
        </button>
      </div>

      {/* Right: Camera Status Badge, Notifications, Time & Settings */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Live Clock / Shift Indicator (Desktop) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] font-mono text-[11px] text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Shift 1 (Pagi)</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-200 font-semibold">{currentTime || "14:30 WIB"}</span>
        </div>

        {/* AI Camera Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase hidden sm:inline">
            AI Camera: Online
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase sm:hidden">
            CAM-01
          </span>
        </div>

        {/* Notification Bell with Unread Badge */}
        <button
          aria-label="Lihat Notifikasi"
          className="relative p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="3 Notifikasi Eskalasi Baru"
        >
          <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-mono font-bold text-zinc-950 shadow-sm shadow-emerald-500/40">
            3
          </span>
        </button>

        {/* Settings Shortcut */}
        <Link
          href="/dashboard/settings"
          aria-label="Pengaturan Sistem"
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Pengaturan"
        >
          <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </Link>
      </div>
    </header>
  );
}

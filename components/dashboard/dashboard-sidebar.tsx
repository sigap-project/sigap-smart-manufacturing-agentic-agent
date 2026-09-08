"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  ScanEye,
  Layers,
  Send,
  Clock,
  Settings,
  ArrowLeft,
  MoreVertical,
  X,
  Radio,
  Sparkles,
} from "lucide-react";

interface DashboardSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function DashboardSidebar({
  mobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { label: "Inspection", href: "/dashboard/inspection", icon: ScanEye },
    { label: "Batch Board", href: "/dashboard/batches", icon: Layers },
    { label: "Export Dispatch", href: "/dashboard/dispatch", icon: Send },
    { label: "Lot History", href: "/dashboard/history", icon: Clock },
  ];

  const otherItems = [
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
    { label: "Kembali ke Beranda", href: "/", icon: ArrowLeft },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#07090e] border-r border-white/[0.08] text-zinc-300 select-none">
      {/* Top Branding Section */}
      <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1px] shadow-md shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
            <div className="w-full h-full bg-[#090b10] rounded-[11px] flex items-center justify-center overflow-hidden">
              <Image
                src="/image/image.png"
                alt="SIGAP Mascot"
                width={36}
                height={36}
                priority
                className="w-full h-full object-cover object-center group-hover:scale-115 transition-transform duration-300"
              />
            </div>
            {/* Online Status Pip */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
              SIGAP
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 font-semibold">
              AGENTIC AI QC
            </span>
          </div>
        </Link>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Tutup Sidebar"
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Main Menu Section */}
        <div>
          <span className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 font-semibold block mb-2.5">
            Menu Utama
          </span>
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/25"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-zinc-950 stroke-[2.5]" : "text-zinc-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Others Section */}
        <div>
          <span className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 font-semibold block mb-2.5">
            Lainnya
          </span>
          <nav className="space-y-1.5">
            {otherItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/25"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-zinc-950 stroke-[2.5]" : "text-zinc-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Footer Row (Matching Reference Layout) */}
      <div className="p-4 border-t border-white/[0.06] bg-[#05070b]">
        <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar Circle with Online Status Dot */}
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1.5px] shrink-0">
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-xs font-mono font-bold text-emerald-400">
                BP
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#07090e]" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">
                Budi Pratama
              </span>
              <span className="text-[10px] font-mono text-zinc-400 truncate">
                QC Supervisor • Line #02
              </span>
            </div>
          </div>

          <button
            aria-label="Pengaturan Akun"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
            title="Opsi Akun"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Sliding Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative w-72 h-full max-w-[85vw] shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

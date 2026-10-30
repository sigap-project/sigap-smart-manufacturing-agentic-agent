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
    { label: "Back to Home", href: "/", icon: ArrowLeft },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80 text-slate-700">
      {/* Top Branding Section */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between"
      >
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 p-0.5 shadow-xs flex items-center justify-center overflow-hidden">
            <Image
              src="/image/image.png"
              alt="SIGAP Mascot"
              width={36}
              height={36}
              priority
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
            {/* Online Status Pip (Solid calm dot) */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          <div className="flex flex-col">
            <span className="font-sans text-base font-bold tracking-tight text-slate-900 group-hover:text-slate-700 transition-colors">
              SIGAP
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Smart QC Operations
            </span>
          </div>
        </Link>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close Menu"
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </motion.div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Main Menu Section */}
        <div>
          <span className="px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium block mb-2">
            Main Menu
          </span>
          <nav className="space-y-1">
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.03 * idx,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ willChange: "transform, opacity" }}
                >
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors select-none group"
                  >
                    {/* Shared Layout Active Indicator Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActivePill"
                        className="absolute inset-0 bg-slate-100 rounded-xl shadow-2xs z-0"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}

                    {/* Icon & Label with Subtle Hover Nudge */}
                    <motion.div
                      className="relative z-10 flex items-center gap-3 w-full"
                      whileHover={{ x: 2.5 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-slate-900 stroke-[2.2]" : "text-slate-400 group-hover:text-slate-800"
                        }`}
                      />
                      <span className={isActive ? "text-slate-900 font-semibold" : "text-slate-600 group-hover:text-slate-900"}>
                        {item.label}
                      </span>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </nav>
        </div>

        {/* Others Section */}
        <div>
          <span className="px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium block mb-2">
            System
          </span>
          <nav className="space-y-1">
            {otherItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.15 + 0.03 * idx,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ willChange: "transform, opacity" }}
                >
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors select-none group"
                  >
                    {/* Shared Layout Active Indicator Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActivePill"
                        className="absolute inset-0 bg-slate-100 rounded-xl shadow-2xs z-0"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}

                    {/* Icon & Label with Subtle Hover Nudge */}
                    <motion.div
                      className="relative z-10 flex items-center gap-3 w-full"
                      whileHover={{ x: 2.5 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-slate-900 stroke-[2.2]" : "text-slate-400 group-hover:text-slate-800"
                        }`}
                      />
                      <span className={isActive ? "text-slate-900 font-semibold" : "text-slate-600 group-hover:text-slate-900"}>
                        {item.label}
                      </span>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Footer Row (FlowDesk Reference Layout) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.22, ease: "easeOut" }}
        className="p-3.5 border-t border-slate-100 bg-white"
      >
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar Circle with Online Status Dot */}
            <div className="relative w-8 h-8 rounded-full bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-xs font-semibold text-slate-700">
              BP
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate">
                Budi Pratama
              </span>
              <span className="text-[11px] text-slate-400 truncate">
                QC Lead • Line #02
              </span>
            </div>
          </div>

          <button
            aria-label="Account Settings"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title="Account Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-40"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div key="mobile-drawer-root" className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              key="mobile-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Sliding Drawer */}
            <motion.aside
              key="mobile-drawer-aside"
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

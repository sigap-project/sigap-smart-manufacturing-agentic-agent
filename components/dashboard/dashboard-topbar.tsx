"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  ChevronDown,
  Settings,
  Factory,
  Check,
} from "lucide-react";
import { NotificationPopover } from "./notification-popover";

interface DashboardTopbarProps {
  plantName?: string;
  lineName?: string;
  onToggleMobileMenu?: () => void;
  className?: string;
}

export function DashboardTopbar({
  plantName = "PT Logam Presisi Nusantara",
  lineName = "Line #02 • High-Pressure Die Casting",
  onToggleMobileMenu,
  className,
}: DashboardTopbarProps) {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [selectedLine, setSelectedLine] = useState(lineName);
  const [isLineMenuOpen, setIsLineMenuOpen] = useState(false);
  const lineMenuRef = useRef<HTMLDivElement>(null);

  const lines = [
    { id: "line-01", name: "Line #01 • Stamping & Stator Core", plant: "PT Logam Presisi Nusantara" },
    { id: "line-02", name: "Line #02 • High-Pressure Die Casting", plant: "PT Logam Presisi Nusantara" },
    { id: "line-03", name: "Line #03 • Robotic CNC Milling", plant: "PT Logam Presisi Nusantara" },
    { id: "line-04", name: "Line #04 • Final Assembly & Packaging", plant: "PT Logam Presisi Nusantara" },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (lineMenuRef.current && !lineMenuRef.current.contains(event.target as Node)) {
        setIsLineMenuOpen(false);
      }
    }
    if (isLineMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLineMenuOpen]);

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
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
      className={
        className
          ? className
          : "sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
      }
    >
      {/* Left: Mobile Hamburger + Current Plant/Line Context Selector */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Buka Menu"
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Plant & Line Context Dropdown with Staggered Open Animation */}
        <div ref={lineMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsLineMenuOpen((prev) => !prev)}
            aria-expanded={isLineMenuOpen}
            className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer active:scale-[0.98] ${
              isLineMenuOpen
                ? "bg-white border-slate-300 ring-2 ring-slate-900/10 shadow-sm"
                : "hover:bg-slate-50 border-transparent hover:border-slate-200"
            }`}
            title="Switch Plant Location or Production Line"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
              <Factory className="w-4 h-4 text-slate-700 group-hover:text-slate-900 transition-colors" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight group-hover:text-slate-700 transition-colors">
                  {plantName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ease-in-out ${
                    isLineMenuOpen ? "rotate-180 text-slate-700" : "rotate-0"
                  }`}
                />
              </div>
              <span className="text-[11px] text-slate-500 truncate max-w-[190px] sm:max-w-none">
                {selectedLine}
              </span>
            </div>
          </button>

          <AnimatePresence>
            {isLineMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ willChange: "transform, opacity", transformOrigin: "top left" }}
                className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_16px_40px_rgba(15,23,42,0.10)] p-2 z-50 overflow-hidden"
              >
                <div className="px-2 py-1.5 mb-1 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Lini Produksi
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-semibold">
                    4 Active Lines
                  </span>
                </div>
                <div className="space-y-1">
                  {lines.map((item, index) => {
                    const isSelected = selectedLine === item.name;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.22,
                          delay: index * 0.035,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{ willChange: "transform, opacity" }}
                        onClick={() => {
                          setSelectedLine(item.name);
                          setIsLineMenuOpen(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isSelected ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          <div className="flex flex-col truncate">
                            <span className="truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {item.plant}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Camera Status Badge, Notifications, Time & Settings */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Live Clock / Shift Indicator (Desktop) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Shift 1 (Morning)</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-900 font-semibold tabular-nums">{currentTime || "14:30:00"}</span>
        </div>

        {/* AI Camera Status Badge (FlowDesk calm pill, no pinging) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium hidden sm:inline">
            AI Camera: Online
          </span>
        </div>

        {/* Interactive Notification Popover with Unread Badge & Live SSE */}
        <NotificationPopover />

        {/* Settings Shortcut */}
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </Link>
      </div>
    </motion.header>
  );
}

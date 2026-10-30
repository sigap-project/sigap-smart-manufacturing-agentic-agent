"use client";

import { motion } from "framer-motion";
import { LucideIcon, ArrowUpRight } from "lucide-react";

export interface TwinFloatingBadgeProps {
  id: string;
  position: string; // Tailwind coordinate e.g. "top-[20%] left-[45%]"
  icon: LucideIcon;
  title: string;
  tagText?: string;
  tagVariant?: "neutral" | "success" | "accent" | "danger" | "warning";
  valueText?: string;
  subtitle: string;
  isActive?: boolean;
  activeTone?: "accent" | "success" | "warning" | "danger";
  delay?: number;
}

const TAG_VARIANTS = {
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  accent: "bg-teal-50 text-teal-700 border-teal-200/80",
  warning: "bg-amber-50 text-amber-700 border-amber-200/80",
  danger: "bg-rose-50 text-rose-700 border-rose-200/80",
};

const ACTIVE_TONES = {
  accent: "ring-1 ring-slate-900 border-slate-900 shadow-sm",
  success: "ring-1 ring-emerald-600 border-emerald-500 shadow-sm",
  warning: "ring-1 ring-amber-600 border-amber-500 shadow-sm",
  danger: "ring-1 ring-rose-600 border-rose-500 shadow-sm",
};

export function TwinFloatingBadge({
  id,
  position,
  icon: Icon,
  title,
  tagText,
  tagVariant = "neutral",
  valueText,
  subtitle,
  isActive = false,
  activeTone = "accent",
  delay = 0,
}: TwinFloatingBadgeProps) {
  return (
    <motion.div
      key={id}
      id={id}
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, delay }}
      className={`absolute ${position} pointer-events-auto`}
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-200 ${
          isActive
            ? ACTIVE_TONES[activeTone]
            : "border-slate-200/80 hover:border-slate-300"
        }`}
      >
        {/* Leading Icon in soft square badge */}
        <div
          className={`p-1.5 rounded-xl transition-colors shrink-0 ${
            isActive
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Text Details & Values */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-xs font-bold text-slate-900 tracking-tight">
              {title}
            </span>
            {tagText && (
              <span
                className={`font-mono text-[9px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide ${TAG_VARIANTS[tagVariant]}`}
              >
                {tagText}
              </span>
            )}
            <ArrowUpRight className="w-3 h-3 text-slate-400 ml-auto shrink-0 opacity-60" />
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {valueText && (
              <span className="font-mono text-xs font-bold text-slate-800">
                {valueText}
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-medium truncate">
              {subtitle}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

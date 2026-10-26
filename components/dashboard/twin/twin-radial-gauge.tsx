"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface TwinRadialGaugeProps {
  value: number; // 0 to 100
  size?: number; // width/height in px, default 180
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  accentColor?: string; // Color 1 (default #059669)
  trackColor?: string;  // Color 2 (default #E2E8F0)
  showTicks?: boolean;
}

export function TwinRadialGauge({
  value = 89.4,
  size = 180,
  strokeWidth = 10,
  label = "Efisiensi OEE",
  sublabel = "Target: 85%",
  accentColor = "#059669",
  trackColor = "#E2E8F0",
  showTicks = true,
}: TwinRadialGaugeProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Arched semi-circle gauge spanning 220 degrees (-200 deg to 20 deg)
  const radius = Math.round(((size - strokeWidth * 2) / 2) * 10) / 10;
  const center = Math.round((size / 2) * 10) / 10;
  const startAngle = -200;
  const endAngle = 20;
  const totalAngle = endAngle - startAngle; // 220 degrees

  // Calculate arc path
  const circumference = Math.round(2 * Math.PI * radius * 10) / 10;
  const arcLength = Math.round(((totalAngle / 360) * circumference) * 10) / 10;
  const displayVal = mounted ? value : 0;
  const filledLength = Math.round(((Math.min(Math.max(displayVal, 0), 100) / 100) * arcLength) * 10) / 10;

  // Generate tickmarks around the arc with integer-rounded coordinates to prevent float hydration mismatch
  const ticks = useMemo(() => {
    if (!showTicks) return [];
    const count = 36;
    const items = [];
    for (let i = 0; i <= count; i++) {
      const angle = (startAngle + (i / count) * totalAngle) * (Math.PI / 180);
      const isFilled = (i / count) * 100 <= displayVal;
      const rInner = radius - 8;
      const rOuter = radius - 2;
      const x1 = Math.round((center + rInner * Math.cos(angle)) * 100) / 100;
      const y1 = Math.round((center + rInner * Math.sin(angle)) * 100) / 100;
      const x2 = Math.round((center + rOuter * Math.cos(angle)) * 100) / 100;
      const y2 = Math.round((center + rOuter * Math.sin(angle)) * 100) / 100;
      items.push({ x1, y1, x2, y2, isFilled });
    }
    return items;
  }, [displayVal, radius, center, showTicks, startAngle, totalAngle]);

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      style={{ width: size, height: size * 0.85 }}
      suppressHydrationWarning
    >
      <svg
        width={size}
        height={size * 0.85}
        viewBox={`0 0 ${size} ${size * 0.85}`}
        className="overflow-visible"
        suppressHydrationWarning
      >
        <defs>
          <linearGradient id="flowosAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Outer Smooth Track Arc (Color 2: Neutral Slate Track) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-200 ${center} ${center})`}
          suppressHydrationWarning
        />

        {/* Outer Filled Value Arc (Color 1: Accent Color) */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={accentColor || "url(#flowosAccentGrad)"}
          strokeWidth={strokeWidth}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filledLength} ${circumference}` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-200 ${center} ${center})`}
          suppressHydrationWarning
        />

        {/* Flowos Ticked Hash Marks */}
        {ticks.map((t, idx) => (
          <line
            key={`tick-${idx}`}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.isFilled ? accentColor : trackColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            className="transition-colors duration-300"
            suppressHydrationWarning
          />
        ))}
      </svg>

      {/* Centered Readout Value & Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center mt-3 pointer-events-none">
        <div className="flex items-baseline">
          <AnimatedCounter
            value={value}
            decimals={1}
            duration={1.2}
            className="font-sans text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
          />
          <span
            className="font-mono text-base font-bold ml-0.5"
            style={{ color: accentColor || "#059669" }}
          >
            %
          </span>
        </div>
        <span className="font-sans text-[11px] font-semibold text-slate-600 mt-0.5">
          {label}
        </span>
        {sublabel && (
          <span className="font-mono text-[9px] text-slate-400 mt-0.5">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedSelect } from "@/components/ui/animated-select";

export interface DefectDispositionItem {
  name: string;
  desc: string;
  count: number;
  percent: number;
  color: string;
  dotColor: string;
  textColor: string;
  stroke: string;
  strokeDasharray: string;
  strokeDashoffset: string;
}

interface DashboardDefectDistributionProps {
  disposition?: DefectDispositionItem[];
  totalDefects?: number;
}

const DEFAULT_DISPOSITION: DefectDispositionItem[] = [
  {
    name: "Auto Quarantine",
    desc: "SAP QM ticket issued, lot quarantined",
    count: 36,
    percent: 52.4,
    color: "from-blue-600 to-blue-700",
    dotColor: "bg-blue-600",
    textColor: "text-blue-700",
    stroke: "#3B82F6",
    strokeDasharray: "230.47 439.82",
    strokeDashoffset: "0",
  },
  {
    name: "Pending Review",
    desc: "Human-in-the-Loop SLA 10 min",
    count: 8,
    percent: 28.6,
    color: "from-amber-500 to-amber-600",
    dotColor: "bg-amber-500",
    textColor: "text-amber-700",
    stroke: "#F59E0B",
    strokeDasharray: "125.79 439.82",
    strokeDashoffset: "-230.47",
  },
  {
    name: "Scrapped / Rejected",
    desc: "Scrap disposition & remelt furnace",
    count: 80,
    percent: 19.0,
    color: "from-purple-500 to-purple-600",
    dotColor: "bg-purple-500",
    textColor: "text-purple-700",
    stroke: "#8B5CF6",
    strokeDasharray: "83.56 439.82",
    strokeDashoffset: "-356.26",
  },
];

export function DashboardDefectDistribution({
  disposition,
  totalDefects: propTotalDefects,
}: DashboardDefectDistributionProps) {
  const [filter, setFilter] = useState("today");

  const filterOptions = [
    { id: "today", label: "Today (Shift 1)" },
    { id: "shift-2", label: "Shift 2 (Afternoon)" },
    { id: "all-shifts", label: "All Shifts (Today)" },
    { id: "7d", label: "Last 7 Days" },
  ];

  const nameMapping: Record<string, string> = {
    "karantina otomatis": "Auto Quarantine",
    "pending konfirmasi": "Pending Review",
    "ditolak / afkir": "Scrapped / Rejected",
    "ditolak": "Scrapped / Rejected",
  };

  const descMapping: Record<string, string> = {
    "karantina otomatis": "SAP QM notification issued, lot quarantined",
    "pending konfirmasi": "Human-in-the-Loop SLA 10 min",
    "ditolak / afkir": "Scrap disposition & remelt furnace",
    "ditolak": "Scrap disposition & remelt furnace",
  };

  const shiftDatasets: Record<string, { items: DefectDispositionItem[]; total: number; containmentRate: number }> = {
    today: {
      items: [
        {
          name: "Auto Quarantine",
          desc: "SAP QM ticket issued, lot quarantined",
          count: 36,
          percent: 52.4,
          color: "from-blue-600 to-blue-700",
          dotColor: "bg-blue-600",
          textColor: "text-blue-700",
          stroke: "#3B82F6",
          strokeDasharray: "230.47 439.82",
          strokeDashoffset: "0",
        },
        {
          name: "Pending Review",
          desc: "Human-in-the-Loop SLA 10 min",
          count: 8,
          percent: 28.6,
          color: "from-amber-500 to-amber-600",
          dotColor: "bg-amber-500",
          textColor: "text-amber-700",
          stroke: "#F59E0B",
          strokeDasharray: "125.79 439.82",
          strokeDashoffset: "-230.47",
        },
        {
          name: "Scrapped / Rejected",
          desc: "Scrap disposition & remelt furnace",
          count: 80,
          percent: 19.0,
          color: "from-purple-500 to-purple-600",
          dotColor: "bg-purple-500",
          textColor: "text-purple-700",
          stroke: "#8B5CF6",
          strokeDasharray: "83.56 439.82",
          strokeDashoffset: "-356.26",
        },
      ],
      total: 124,
      containmentRate: 96.8,
    },
    "shift-2": {
      items: [
        {
          name: "Auto Quarantine",
          desc: "SAP QM ticket issued, lot quarantined",
          count: 24,
          percent: 48.0,
          color: "from-blue-600 to-blue-700",
          dotColor: "bg-blue-600",
          textColor: "text-blue-700",
          stroke: "#3B82F6",
          strokeDasharray: "205.08 439.82",
          strokeDashoffset: "0",
        },
        {
          name: "Pending Review",
          desc: "Human-in-the-Loop SLA 10 min",
          count: 6,
          percent: 22.0,
          color: "from-amber-500 to-amber-600",
          dotColor: "bg-amber-500",
          textColor: "text-amber-700",
          stroke: "#F59E0B",
          strokeDasharray: "94.00 439.82",
          strokeDashoffset: "-205.08",
        },
        {
          name: "Scrapped / Rejected",
          desc: "Scrap disposition & remelt furnace",
          count: 50,
          percent: 30.0,
          color: "from-purple-500 to-purple-600",
          dotColor: "bg-purple-500",
          textColor: "text-purple-700",
          stroke: "#8B5CF6",
          strokeDasharray: "128.18 439.82",
          strokeDashoffset: "-299.08",
        },
      ],
      total: 80,
      containmentRate: 97.4,
    },
    "all-shifts": {
      items: [
        {
          name: "Auto Quarantine",
          desc: "SAP QM ticket issued, lot quarantined",
          count: 60,
          percent: 51.2,
          color: "from-blue-600 to-blue-700",
          dotColor: "bg-blue-600",
          textColor: "text-blue-700",
          stroke: "#3B82F6",
          strokeDasharray: "218.75 439.82",
          strokeDashoffset: "0",
        },
        {
          name: "Pending Review",
          desc: "Human-in-the-Loop SLA 10 min",
          count: 14,
          percent: 25.6,
          color: "from-amber-500 to-amber-600",
          dotColor: "bg-amber-500",
          textColor: "text-amber-700",
          stroke: "#F59E0B",
          strokeDasharray: "109.38 439.82",
          strokeDashoffset: "-218.75",
        },
        {
          name: "Scrapped / Rejected",
          desc: "Scrap disposition & remelt furnace",
          count: 130,
          percent: 23.2,
          color: "from-purple-500 to-purple-600",
          dotColor: "bg-purple-500",
          textColor: "text-purple-700",
          stroke: "#8B5CF6",
          strokeDasharray: "99.12 439.82",
          strokeDashoffset: "-328.13",
        },
      ],
      total: 204,
      containmentRate: 97.1,
    },
    "7d": {
      items: [
        {
          name: "Auto Quarantine",
          desc: "SAP QM ticket issued, lot quarantined",
          count: 280,
          percent: 54.5,
          color: "from-blue-600 to-blue-700",
          dotColor: "bg-blue-600",
          textColor: "text-blue-700",
          stroke: "#3B82F6",
          strokeDasharray: "232.85 439.82",
          strokeDashoffset: "0",
        },
        {
          name: "Pending Review",
          desc: "Human-in-the-Loop SLA 10 min",
          count: 45,
          percent: 18.5,
          color: "from-amber-500 to-amber-600",
          dotColor: "bg-amber-500",
          textColor: "text-amber-700",
          stroke: "#F59E0B",
          strokeDasharray: "79.04 439.82",
          strokeDashoffset: "-232.85",
        },
        {
          name: "Scrapped / Rejected",
          desc: "Scrap disposition & remelt furnace",
          count: 480,
          percent: 27.0,
          color: "from-purple-500 to-purple-600",
          dotColor: "bg-purple-500",
          textColor: "text-purple-700",
          stroke: "#8B5CF6",
          strokeDasharray: "115.36 439.82",
          strokeDashoffset: "-311.89",
        },
      ],
      total: 805,
      containmentRate: 98.2,
    },
  };

  const activeData = shiftDatasets[filter] || shiftDatasets.today;
  const rawItems = disposition && filter === "today" ? disposition : activeData.items;
  const items = rawItems.map((item) => {
    const key = item.name.toLowerCase().trim();
    return {
      ...item,
      name: nameMapping[key] || item.name,
      desc: descMapping[key] || item.desc,
    };
  });

  const total = propTotalDefects !== undefined && filter === "today" ? propTotalDefects : activeData.total;
  const containmentRate = activeData.containmentRate;

  // Donut geometry for FlowDesk Pipeline Value style:
  // r = 68, C = 2 * pi * 68 = 427.256
  const radius = 68;
  const circumference = 2 * Math.PI * radius; // ~427.26

  // Calculate proportional stroke lengths based on item percentages
  const seg1Length = (items[0]?.percent / 100) * circumference;
  const seg2Length = (items[1]?.percent / 100) * circumference;
  const seg3Length = (items[2]?.percent / 100) * circumference;

  const seg1Offset = 0;
  const seg2Offset = -seg1Length;
  const seg3Offset = -(seg1Length + seg2Length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay: 0.44, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
      className="rounded-2xl p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between select-none hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="font-sans text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Defect Disposition
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Resolution status of detected defect anomalies
          </p>
        </div>

        <AnimatedSelect
          value={filter}
          onChange={setFilter}
          options={filterOptions}
          align="right"
          ariaLabel="Filter defect disposition shift"
        />
      </div>

      {/* FlowDesk 3-Tone Donut Chart */}
      <div className="relative flex items-center justify-center my-3">
        <svg
          viewBox="0 0 180 180"
          className="w-48 h-48 -rotate-90 transform"
        >
          {/* Background Track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="14"
          />

          {/* Segment 1: Auto Quarantine (Blue) */}
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="14"
            strokeDasharray={`${seg1Length} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: seg1Offset }}
            transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            strokeLinecap="round"
          />

          {/* Segment 2: Pending Review (Orange/Amber) */}
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="14"
            strokeDasharray={`${seg2Length} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: seg2Offset }}
            transition={{ duration: 1.1, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
            strokeLinecap="round"
          />

          {/* Segment 3: Scrapped / Rejected (Purple) */}
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="14"
            strokeDasharray={`${seg3Length} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: seg3Offset }}
            transition={{ duration: 1.1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Donut Metrics (FlowDesk Pipeline Value Style) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            QC Containment
          </span>
          <span className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight mt-0.5">
            <AnimatedCounter value={containmentRate} decimals={1} suffix="%" duration={1.2} />
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
            Total Defects: <AnimatedCounter value={total} duration={1.0} /> Pcs
          </span>
        </div>
      </div>

      {/* Horizontal Tag Pills (FlowDesk style) */}
      <div className="flex items-center justify-center gap-3 py-1 text-[11px] font-medium text-slate-600 border-b border-slate-100 pb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Auto Quarantine
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Scrapped
        </span>
      </div>

      {/* Clean Disposition Item Rows */}
      <div className="mt-2.5 space-y-1.5">
        {items.map((item, index) => {
          const dotColor =
            index === 0
              ? "bg-blue-500"
              : index === 1
              ? "bg-amber-500"
              : "bg-purple-500";

          return (
            <div
              key={`legend-${item.name}`}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs font-semibold text-slate-900 tabular-nums px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200/70">
                  {item.count} pcs
                </span>
                <span className="text-xs text-slate-500 w-12 text-right font-medium tabular-nums">
                  {item.percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

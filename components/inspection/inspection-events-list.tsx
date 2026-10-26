"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Clock, Sparkles, Radio } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

const DEFAULT_EVENTS = [
  {
    id: "EV-1428",
    label: "defect",
    status: "DEFECT",
    confidence: 96.4,
    time: "0.4s ago",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: true,
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    barColor: "bg-rose-500",
    thumbCode: "DEF",
    thumbBg: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    id: "EV-1427",
    label: "ok",
    status: "PASSED",
    confidence: 99.4,
    time: "1.8s ago",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: false,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    barColor: "bg-emerald-500",
    thumbCode: "OK",
    thumbBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    id: "EV-1426",
    label: "defect",
    status: "DEFECT",
    confidence: 94.8,
    time: "3.2s ago",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: true,
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    barColor: "bg-rose-500",
    thumbCode: "DEF",
    thumbBg: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    id: "EV-1425",
    label: "ok",
    status: "PASSED",
    confidence: 98.7,
    time: "4.5s ago",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: false,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    barColor: "bg-emerald-500",
    thumbCode: "OK",
    thumbBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
];

interface InspectionEventsListProps {
  events?: any[];
}

export function InspectionEventsList({ events: initialEvents }: InspectionEventsListProps) {
  const [events, setEvents] = useState<any[]>(
    initialEvents && initialEvents.length > 0 ? initialEvents : DEFAULT_EVENTS
  );
  const [newestId, setNewestId] = useState<string | null>(null);

  // Update when initialEvents from SSR change
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, [initialEvents]);

  // Listen to live SSE events
  const { isConnected } = useSigapEvents({
    onInspectionCreated: (newIns) => {
      const isDefect =
        newIns.defectDetected ??
        (newIns.defectClass?.toLowerCase() !== "ok");
      const eventId = `EV-SSE-${String(newIns.id)}`;

      const rawLot = newIns.batchId || newIns.lotId || "B-2026-0730";
      const normLot = (() => {
        const s = String(rawLot).trim();
        const cleaned = s.replace(/^batch-/i, "");
        return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
      })();

      const newItem = {
        id: eventId,
        label: isDefect ? "defect" : "ok",
        status: isDefect ? "DEFECT" : "PASSED",
        confidence: Number((newIns.confidence ?? 95).toFixed(1)),
        time: "Just now",
        lot: normLot,
        part: newIns.partName || "Bracket A7",
        isDefect,
        badgeColor: isDefect
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200",
        barColor: isDefect ? "bg-rose-500" : "bg-emerald-500",
        thumbCode: isDefect ? "DEF" : "OK",
        thumbBg: isDefect
          ? "bg-rose-50 border-rose-200 text-rose-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700",
      };

      setNewestId(eventId);
      setEvents((prev) => [newItem, ...prev.filter((e) => e.id !== eventId).slice(0, 7)]);
      setTimeout(() => setNewestId(null), 3000);
    },
  });

  return (
    <div className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between select-none hover:-translate-y-1 hover:shadow-md transition-all duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-sans text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
              Recent Inspection Events
            </h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/70 font-medium shrink-0">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Real-time optical frame detection log
          </p>
        </div>

        <div
          className={`shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isConnected
              ? "text-emerald-700 bg-emerald-50 border-emerald-200/70"
              : "text-amber-700 bg-amber-50 border-amber-200/70"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-amber-400"
            }`}
          />
          <span className="font-medium">{isConnected ? "Live Stream" : "Connecting..."}</span>
        </div>
      </div>

      {/* Events Scroll List */}
      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {events.map((ev, idx) => {
          const isLatest = ev.id === newestId;
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.38 + idx * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ willChange: "transform, opacity" }}
              className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 group ${
                isLatest
                  ? "bg-blue-50/50 border-blue-300 shadow-2xs ring-1 ring-blue-300"
                  : "bg-white border-slate-200/70 hover:bg-slate-50"
              }`}
            >
              {/* Left: Thumbnail & Class */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center font-sans text-xs font-bold shrink-0 ${ev.thumbBg}`}
                >
                  {ev.thumbCode}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate capitalize">
                      {ev.label}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.badgeColor}`}
                    >
                      {ev.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>{ev.lot}</span>
                    <span>•</span>
                    <span>{ev.time}</span>
                  </div>
                </div>
              </div>

              {/* Right: Confidence Score & Progress Bar */}
              <div className="flex flex-col items-end shrink-0 gap-1">
                <span className="text-xs font-bold text-slate-900 tabular-nums">
                  {ev.confidence}%
                </span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className={`h-full rounded-full ${ev.barColor}`}
                    style={{ width: `${ev.confidence}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


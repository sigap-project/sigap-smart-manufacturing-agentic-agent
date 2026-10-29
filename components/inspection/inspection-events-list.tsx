"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { InspectionRecord } from "@/components/history/types";

interface InspectionEventsListProps {
  events?: InspectionRecord[];
}

export function InspectionEventsList({ events = [] }: InspectionEventsListProps) {
  const [prevFirstId, setPrevFirstId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (events && events.length > 0) {
      const firstId = events[0].id;
      if (prevFirstId && firstId !== prevFirstId) {
        setHighlightId(firstId);
        const timer = setTimeout(() => setHighlightId(null), 3000);
        return () => clearTimeout(timer);
      }
      setPrevFirstId(firstId);
    }
  }, [events, prevFirstId]);

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
              Station Log
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Persisted workpiece inspection history
          </p>
        </div>
      </div>

      {/* Events Scroll List */}
      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No inspections yet
          </div>
        ) : (
          events.slice(0, 10).map((ev, idx) => {
            const outcome = ev.outcome || (ev.defectDetected ? "defect" : "ok");
            const isDefect = outcome === "defect";
            const isUnknown = outcome === "unknown";

            const badgeColor = isDefect
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : isUnknown
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200";

            const barColor = isDefect
              ? "bg-rose-500"
              : isUnknown
              ? "bg-amber-500"
              : "bg-emerald-500";

            const thumbCode = isDefect ? "DEF" : isUnknown ? "REV" : "OK";
            const thumbBg = isDefect
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : isUnknown
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700";

            const statusText = isDefect ? "DEFECT" : isUnknown ? "NEEDS REVIEW" : "PASSED";
            const labelText = isDefect
              ? ev.defectClass || "defect"
              : isUnknown
              ? "Needs review"
              : "OK";

            const isLatest = ev.id === highlightId;

            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  delay: 0.1 + idx * 0.03,
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
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center font-sans text-xs font-bold shrink-0 ${thumbBg}`}
                  >
                    {thumbCode}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate capitalize">
                        {labelText}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}
                      >
                        {statusText}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                      <span>{ev.lotId || ev.batchId}</span>
                      {ev.itemId && (
                        <>
                          <span>•</span>
                          <span>{ev.itemId}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{ev.timestamp || new Date(ev.rawDate).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Confidence Score & Progress Bar */}
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    {ev.confidence !== null && ev.confidence !== undefined
                      ? `${ev.confidence}%`
                      : "—"}
                  </span>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{
                        width: `${ev.confidence !== null && ev.confidence !== undefined ? ev.confidence : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

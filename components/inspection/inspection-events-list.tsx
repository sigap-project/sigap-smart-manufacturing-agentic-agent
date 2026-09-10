"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Clock, Sparkles, Radio } from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";

const DEFAULT_EVENTS = [
  {
    id: "EV-1428",
    label: "defect",
    status: "DEFECT",
    confidence: 96.4,
    time: "0.4s lalu",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: true,
    badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    barColor: "bg-rose-400",
    thumbCode: "DEF",
    thumbBg: "bg-rose-950/40 border-rose-500/40 text-rose-300",
  },
  {
    id: "EV-1427",
    label: "ok",
    status: "PASSED",
    confidence: 99.4,
    time: "1.8s lalu",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: false,
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    barColor: "bg-emerald-400",
    thumbCode: "OK",
    thumbBg: "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
  },
  {
    id: "EV-1426",
    label: "defect",
    status: "DEFECT",
    confidence: 94.8,
    time: "3.2s lalu",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: true,
    badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    barColor: "bg-rose-400",
    thumbCode: "DEF",
    thumbBg: "bg-rose-950/40 border-rose-500/40 text-rose-300",
  },
  {
    id: "EV-1425",
    label: "ok",
    status: "PASSED",
    confidence: 98.7,
    time: "4.5s lalu",
    lot: "Lot #B-2026-0730",
    part: "Bracket A7",
    isDefect: false,
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    barColor: "bg-emerald-400",
    thumbCode: "OK",
    thumbBg: "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
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

  // Perbarui saat initialEvents dari SSR berganti
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, [initialEvents]);

  // Dengarkan event SSE live
  const { isConnected } = useSigapEvents({
    onInspectionCreated: (newIns) => {
      const isDefect =
        newIns.defectDetected ??
        (newIns.defectClass?.toLowerCase() !== "ok");
      const eventId = `EV-${String(newIns.id).slice(-4)}`;

      const newItem = {
        id: eventId,
        label: isDefect ? "defect" : "ok",
        status: isDefect ? "DEFECT" : "PASSED",
        confidence: Number((newIns.confidence ?? 95).toFixed(1)),
        time: "Baru saja",
        lot: newIns.batchId
          ? String(newIns.batchId).startsWith("#")
            ? newIns.batchId
            : `#${newIns.batchId}`
          : "Lot #B-2026-0730",
        part: newIns.partName || "Bracket A7",
        isDefect,
        badgeColor: isDefect
          ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        barColor: isDefect ? "bg-rose-400" : "bg-emerald-400",
        thumbCode: isDefect ? "DEF" : "OK",
        thumbBg: isDefect
          ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
          : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
      };

      setNewestId(eventId);
      setEvents((prev) => [newItem, ...prev.slice(0, 7)]);

      // Hapus highlight setelah 3 detik
      setTimeout(() => setNewestId(null), 3000);
    },
  });

  return (
    <div className="rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
              Kejadian Terbaru
            </h3>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.10]">
              Real-Time Frame Feed
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Log deteksi kamera optik per frame konveyor
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            isConnected
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-amber-400 bg-amber-500/10 border-amber-500/20"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span>{isConnected ? "Live Stream" : "Connecting..."}</span>
        </div>
      </div>

      {/* Events Scroll List */}
      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {events.map((ev) => {
          const isLatest = ev.id === newestId;
          return (
            <div
              key={ev.id}
              className={`p-2.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 group ${
                isLatest
                  ? "bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/30"
                  : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.10]"
              }`}
            >
              {/* Left: Thumbnail & Class */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono text-[11px] font-bold shrink-0 shadow-inner ${ev.thumbBg}`}
                >
                  {ev.thumbCode}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {ev.label}
                    </span>
                    <span
                      className={`font-mono text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${ev.badgeColor}`}
                    >
                      {ev.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-zinc-400">
                    <span>{ev.lot}</span>
                    <span>•</span>
                    <span>{ev.time}</span>
                  </div>
                </div>
              </div>

              {/* Right: Confidence Score & Progress Bar */}
              <div className="flex flex-col items-end shrink-0 gap-1">
                <span className="font-mono text-xs font-bold text-white">
                  {ev.confidence}%
                </span>
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ev.barColor}`}
                    style={{ width: `${ev.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


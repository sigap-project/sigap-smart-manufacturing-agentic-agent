"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { useSigapEvents } from "@/hooks/useSigapEvents";
import { useSigapGlobal } from "@/context/sigap-global-context";

interface ActivityItem {
  id?: string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  status: string;
  badgeColor: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  isNew?: boolean;
}

// Collision-proof ID generator for real-time SSE activities
let actCounter = 0;
function generateUniqueActivityId(prefix: string, entityId?: string | number) {
  actCounter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  const entityClean = entityId ? `-${String(entityId).replace(/[^a-zA-Z0-9_-]/g, "")}` : "";
  return `${prefix}${entityClean}-${Date.now()}-${actCounter}-${rand}`;
}

export function DashboardRecentActivity() {
  const { dispatches } = useSigapGlobal();
  // Live SSE items (same-process events only); persisted dispatch records fill the rest
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const dispatchItems: ActivityItem[] = dispatches.slice(0, 5).map((d) => {
    const done = d.status === "Dispatched";
    const rejected = d.status === "Rejected";
    return {
      id: `dsp-${d.id}`,
      title: `${d.consumer}: ${d.actionSummary || d.defectCode || "ERP action"}`,
      description: `${d.id} • ${d.batchId} • ${d.triggerReason}`,
      source: d.approvedBy ? `Approved by ${d.approvedBy.split(":")[0]}` : "Governed agent proposal",
      timestamp: d.timestamp,
      status: d.status,
      badgeColor: done
        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
        : rejected
        ? "bg-rose-50 text-rose-700 border-rose-200/80"
        : "bg-amber-50 text-amber-700 border-amber-200/80",
      icon: Send,
      iconColor: done ? "text-emerald-600" : rejected ? "text-rose-600" : "text-amber-600",
      iconBg: done
        ? "bg-emerald-50 border-emerald-200/70"
        : rejected
        ? "bg-rose-50 border-rose-200/70"
        : "bg-amber-50 border-amber-200/70",
    };
  });
  const shown = [...activities, ...dispatchItems].slice(0, 5);

  // Dengarkan seluruh event operasional SIGAP melalui SSE
  const { isConnected } = useSigapEvents({
    onInspectionCreated: (newIns) => {
      const isDefect = newIns.defectDetected ?? (newIns.defectClass !== "OK");
      const uniqueId = generateUniqueActivityId("act-ins", newIns.id);
      const newItem: ActivityItem = {
        id: uniqueId,
        title: isDefect
          ? `Anomaly Detected: ${newIns.defectClass}`
          : `Unit Passed Inspection: ${newIns.partName || "Motor Bracket"}`,
        description: `Frame #${String(newIns.id).slice(-4)} (${newIns.confidence}% confidence) inspected on ${newIns.batchId || "Active Lot"}`,
        source: "Station #01 • YOLOv8-Nano",
        timestamp: "Just now",
        status: isDefect ? "Held" : "Passed",
        badgeColor: isDefect
          ? "bg-amber-50 text-amber-700 border-amber-200/80"
          : "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        icon: isDefect ? AlertTriangle : CheckCircle2,
        iconColor: isDefect ? "text-amber-600" : "text-emerald-600",
        iconBg: isDefect
          ? "bg-amber-50 border-amber-200/70"
          : "bg-emerald-50 border-emerald-200/70",
        isNew: true,
      };

      setActivities((prev) => {
        if (prev.some((a) => a.id === uniqueId)) return prev;
        return [newItem, ...prev.slice(0, 4)];
      });
    },
    onDispatchStatusChanged: (dispatch) => {
      const uniqueId = generateUniqueActivityId("act-disp", dispatch.id);
      const isDispatched = dispatch.status === "Dispatched";
      const newItem: ActivityItem = {
        id: uniqueId,
        title: `Ticket ${dispatch.consumer} ${dispatch.status}`,
        description: `${dispatch.id}: ${dispatch.triggerReason || "Automated sync to SAP ERP"}`,
        source: "Agentic Dispatch Gateway",
        timestamp: "Just now",
        status: dispatch.status,
        badgeColor: isDispatched
          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
          : "bg-amber-50 text-amber-700 border-amber-200/80",
        icon: Send,
        iconColor: isDispatched ? "text-emerald-600" : "text-amber-600",
        iconBg: isDispatched
          ? "bg-emerald-50 border-emerald-200/70"
          : "bg-amber-50 border-amber-200/70",
        isNew: true,
      };

      setActivities((prev) => {
        if (prev.some((a) => a.id === uniqueId)) return prev;
        return [newItem, ...prev.slice(0, 4)];
      });
    },
    onBatchStatusChanged: (batch) => {
      const isReleased = batch.status === "released";
      const isRejected = batch.status === "rejected";
      const uniqueId = generateUniqueActivityId("act-batch", batch.lotId || batch.id);
      const newItem: ActivityItem = {
        id: uniqueId,
        title: `Batch ${batch.lotId} Status: ${String(batch.status).toUpperCase()}`,
        description: `Manufacturing lot lifecycle update (${batch.defectCount || 0} anomalies recorded)`,
        source: "Batch Lifecycle Engine",
        timestamp: "Just now",
        status: isReleased ? "Released" : isRejected ? "Quarantined" : "Held",
        badgeColor: isReleased
          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
          : isRejected
          ? "bg-rose-50 text-rose-700 border-rose-200/80"
          : "bg-amber-50 text-amber-700 border-amber-200/80",
        icon: Package,
        iconColor: isReleased
          ? "text-emerald-600"
          : isRejected
          ? "text-rose-600"
          : "text-amber-600",
        iconBg: isReleased
          ? "bg-emerald-50 border-emerald-200/70"
          : isRejected
          ? "bg-rose-50 border-rose-200/70"
          : "bg-amber-50 border-amber-200/70",
        isNew: true,
      };

      setActivities((prev) => {
        if (prev.some((a) => a.id === uniqueId)) return prev;
        return [newItem, ...prev.slice(0, 4)];
      });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
      className="rounded-2xl p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-sans text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Recent Agent Activities
            </h3>
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1.5 ${
                isConnected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                  : "bg-amber-50 text-amber-700 border-amber-200/70"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <span>{isConnected ? "Live Stream" : "Polling"}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Autonomous AWS Bedrock action logs dispatched to physical line &amp; SAP ERP
          </p>
        </div>

        <button
          aria-label="View All Logs"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/70 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          title="Open Complete Logs"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {shown.length === 0 && (
          <p className="p-6 text-center text-xs text-slate-400 font-mono">No agent actions recorded yet.</p>
        )}
        {shown.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id || `act-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.60 + idx * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ willChange: "transform, opacity" }}
              className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                item.isNew
                  ? "bg-emerald-50/40 border-emerald-200/80 shadow-2xs"
                  : "bg-white hover:bg-slate-50/80 border-slate-200/70"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2 rounded-xl border shrink-0 mt-0.5 sm:mt-0 ${item.iconBg}`}
                >
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {item.title}
                  </span>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] font-sans text-slate-400">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex sm:justify-end">
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}
                >
                  {item.status}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}


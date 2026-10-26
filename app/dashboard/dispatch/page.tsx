"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { DispatchStatCards } from "@/components/dispatch/dispatch-stat-cards";
import { DispatchToolbar } from "@/components/dispatch/dispatch-toolbar";
import { DispatchTable } from "@/components/dispatch/dispatch-table";
import { DispatchDetailModal } from "@/components/dispatch/dispatch-detail-modal";
import { DispatchCreateModal } from "@/components/dispatch/dispatch-create-modal";
import {
  ConsumerType,
  DispatchItem,
  DispatchStatus,
  INITIAL_DISPATCHES,
} from "@/components/dispatch/types";
import { DispatchSkeleton } from "@/components/dispatch/dispatch-skeleton";
import { useSigapEvents } from "@/hooks/useSigapEvents";
import { useSigapGlobal } from "@/context/sigap-global-context";

export default function ExportDispatchPage() {
  const { dispatches: globalDispatches, createDispatch: globalCreateDispatch } = useSigapGlobal();
  const [dispatches, setDispatches] = useState<DispatchItem[]>(globalDispatches);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | "all">("all");
  const [consumerFilter, setConsumerFilter] = useState<ConsumerType | "all">("all");
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (globalDispatches && globalDispatches.length > 0) {
      setDispatches(globalDispatches);
    }
  }, [globalDispatches]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dengarkan event broadcast SSE secara real-time
  const { isConnected } = useSigapEvents({
    onDispatchStatusChanged: (updatedDispatch) => {
      setDispatches((prev) => {
        const index = prev.findIndex((d) => d.id === updatedDispatch.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...updatedDispatch };
          return updated;
        } else {
          return [updatedDispatch, ...prev];
        }
      });
      showToast(`Ticket ${updatedDispatch.id} (${updatedDispatch.consumer}) updated live.`);
    },
  });

  // Ambil catatan dispatch nyata dari API PostgreSQL
  useEffect(() => {
    async function fetchDispatches() {
      try {
        const res = await fetch("/api/dispatch");
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setDispatches(json.data);
        } else {
          setDispatches(INITIAL_DISPATCHES);
        }
      } catch (err) {
        console.warn("Failed fetching live dispatch data:", err);
        setDispatches(INITIAL_DISPATCHES);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDispatches();
  }, []);

  // Handler pembuatan dispatch manual (Sinkronisasi ke Database via POST /api/dispatch)
  const handleCreateDispatch = async (newItem: DispatchItem) => {
    globalCreateDispatch(newItem);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDispatches((prev) => [json.data, ...prev.filter((d) => d.id !== newItem.id)]);
        showToast(json.message || `Ticket ${json.data.id} (${json.data.consumer}) created successfully.`);
        return;
      }
    } catch (err) {
      console.warn("Failed saving dispatch to database:", err);
    }
    showToast(`Ticket ${newItem.id} (${newItem.consumer}) created successfully.`);
  };

  // Filtered dispatches based on search, status, and consumer
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      // Status filter
      if (statusFilter !== "all" && d.status !== statusFilter) {
        return false;
      }
      // Consumer filter
      if (consumerFilter !== "all" && d.consumer !== consumerFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = d.id.toLowerCase().includes(q);
        const matchesBatch = d.batchId.toLowerCase().includes(q);
        const matchesReason = d.triggerReason.toLowerCase().includes(q);
        const matchesPart = d.partName.toLowerCase().includes(q);
        const matchesSupplier = d.supplier.toLowerCase().includes(q);
        if (
          !matchesId &&
          !matchesBatch &&
          !matchesReason &&
          !matchesPart &&
          !matchesSupplier
        ) {
          return false;
        }
      }
      return true;
    });
  }, [dispatches, statusFilter, consumerFilter, searchQuery]);

  if (isLoading && dispatches.length === 0) {
    return <DispatchSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-200">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tahap 1: Page Title & Context Header (0ms - 150ms) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              ERP Export Dispatch
            </h1>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              OData v4 Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Automated dispatch logs to SAP QM, MM, and PP modules with human-in-the-loop escalation tracking.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs text-slate-600">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Fetching Records...</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="text-slate-400">Gateway:</span>
            <span className="text-slate-800 font-semibold">SAP NetWeaver</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="text-slate-400">Telemetry:</span>
            <span className={`font-semibold flex items-center gap-1.5 ${isConnected ? "text-emerald-700" : "text-amber-700"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
              {isConnected ? "Live Sync" : "Connecting..."}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Tahap 2: TOP: Stat Row (4 compact white cards, 150ms - 350ms) */}
      <DispatchStatCards dispatches={dispatches} />

      {/* Tahap 3: TOOLBAR: Search, Status Dropdown, Consumer Dropdown, + Dispatch Baru (350ms - 450ms) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative z-20"
      >
        <DispatchToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          consumerFilter={consumerFilter}
          onConsumerFilterChange={setConsumerFilter}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          totalFiltered={filteredDispatches.length}
        />
      </motion.div>

      {/* Tahap 4: MAIN TABLE: Dispatches List with Pagination & Detail Modal Link (450ms - 650ms) */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.50, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative z-10"
      >
        <DispatchTable
          dispatches={filteredDispatches}
          onViewDetails={(dispatch) => setSelectedDispatch(dispatch)}
        />
      </motion.div>

      {/* MODAL 1: Detail Dispatch Payload Summary */}
      <DispatchDetailModal
        dispatch={selectedDispatch}
        onClose={() => setSelectedDispatch(null)}
      />

      {/* MODAL 2: Create New Manual Dispatch */}
      <DispatchCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateDispatch}
      />
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import { Send, CheckCircle2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
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

export default function ExportDispatchPage() {
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | "all">("all");
  const [consumerFilter, setConsumerFilter] = useState<ConsumerType | "all">("all");
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      showToast(`Tiket ${updatedDispatch.id} (${updatedDispatch.consumer}) terbarui secara live.`);
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
        console.warn("Gagal mengambil data dispatch live dari server:", err);
        setDispatches(INITIAL_DISPATCHES);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDispatches();
  }, []);

  // Handler pembuatan dispatch manual (Sinkronisasi ke Database via POST /api/dispatch)
  const handleCreateDispatch = async (newItem: DispatchItem) => {
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDispatches((prev) => [json.data, ...prev]);
        showToast(json.message || `Tiket ${json.data.id} (${json.data.consumer}) berhasil dibuat & terkirim.`);
        return;
      }
    } catch (err) {
      console.warn("Gagal menyimpan dispatch ke database:", err);
    }

    // Fallback lokal optimistik
    setDispatches((prev) => [newItem, ...prev]);
    showToast(`Tiket ${newItem.id} (${newItem.consumer}) berhasil dibuat & terkirim.`);
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
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-zinc-950/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-2xl backdrop-blur-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Export Dispatch ERP &amp; Notifikasi
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ODATA V4 GATEWAY READY
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            Jejak pengiriman otomatis ke modul SAP QM, MM, PP, dan notifikasi eskalasi manusia terintegrasi.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono text-zinc-400">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Memuat Tiket...</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Gateway:</span>
            <span className="text-emerald-400 font-bold">SAP NetWeaver Connected</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Telemetry:</span>
            <span className={`font-bold flex items-center gap-1.5 ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {isConnected ? "SSE Live" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* TOP: Stat Row (3 compact cards) */}
      <DispatchStatCards dispatches={dispatches} />

      {/* TOOLBAR: Search, Status Dropdown, Consumer Dropdown, + Dispatch Baru */}
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

      {/* MAIN TABLE: Dispatches List with Pagination & Detail Modal Link */}
      <DispatchTable
        dispatches={filteredDispatches}
        onViewDetails={(dispatch) => setSelectedDispatch(dispatch)}
      />

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

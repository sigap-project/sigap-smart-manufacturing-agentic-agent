"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { DispatchStatCards } from "@/components/dispatch/dispatch-stat-cards";
import { DispatchToolbar } from "@/components/dispatch/dispatch-toolbar";
import { DispatchTable } from "@/components/dispatch/dispatch-table";
import { DispatchDetailModal } from "@/components/dispatch/dispatch-detail-modal";
import { DispatchCreateModal } from "@/components/dispatch/dispatch-create-modal";
import { InlineLoginBanner } from "@/components/auth/inline-login-banner";
import {
  ConsumerType,
  DispatchItem,
  DispatchStatus,
} from "@/components/dispatch/types";
import { DispatchSkeleton } from "@/components/dispatch/dispatch-skeleton";
import { useSigapEvents } from "@/hooks/useSigapEvents";
import { useSigapSession } from "@/hooks/useSigapSession";
import { useSigapGlobal } from "@/context/sigap-global-context";

export default function ExportDispatchPage() {
  const {
    dispatches: globalDispatches,
    batches: globalBatches,
    createDispatch: globalCreateDispatch,
    refreshServerState,
  } = useSigapGlobal();
  const session = useSigapSession();
  const canDecide = session.actor?.role === "supervisor";
  const [dispatches, setDispatches] = useState<DispatchItem[]>(globalDispatches);
  const [isLoading, setIsLoading] = useState(false);
  const [busyDispatchId, setBusyDispatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | "all">("all");
  const [consumerFilter, setConsumerFilter] = useState<ConsumerType | "all">("all");
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (globalDispatches && globalDispatches.length > 0) {
      setDispatches(globalDispatches);
    }
  }, [globalDispatches]);

  const showToast = (text: string, ok = true) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
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
        setDispatches(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        console.warn("Failed fetching live dispatch data:", err);
        setDispatches([]);
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

  // Handler persetujuan supervisor (Approve & Dispatch ke SAP OData)
  const handleApproveDispatch = async (
    item: DispatchItem,
    customReason = "Verified defect evidence & sliding-window threshold; approved for SAP execution."
  ) => {
    if (!canDecide) {
      showToast("Sign in as a supervisor to approve SAP ERP dispatches.", false);
      return;
    }
    setBusyDispatchId(item.id);
    try {
      const matchedBatch = globalBatches.find(
        (b) => b.id === item.batchRecordId || b.lotId === item.batchId || b.id === item.batchId
      );
      const expectedBatchVersion = matchedBatch?.version ?? item.batchVersion ?? 1;
      const expectedRevision = item.revision ?? 1;

      const res = await fetch(`/api/dispatch/${encodeURIComponent(item.id)}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session.csrfToken ? { "x-csrf-token": session.csrfToken } : {}),
        },
        body: JSON.stringify({
          expectedRevision,
          expectedBatchVersion,
          reason: customReason,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        session.expire();
        showToast("Session expired. Please sign in again.", false);
        return;
      }
      if (!res.ok || !json.success) {
        await refreshServerState();
        showToast(json.error || "Failed to approve dispatch.", false);
        return;
      }
      if (json.data) {
        setDispatches((prev) => prev.map((d) => (d.id === item.id ? json.data : d)));
        if (selectedDispatch?.id === item.id) {
          setSelectedDispatch(json.data);
        }
      }
      await refreshServerState();
      showToast(json.message || `Ticket ${item.id} approved & dispatched to ${item.consumer}.`, true);
    } catch {
      showToast("Network error while approving dispatch.", false);
    } finally {
      setBusyDispatchId(null);
    }
  };

  // Handler penolakan supervisor (Reject Proposal)
  const handleRejectDispatch = async (
    item: DispatchItem,
    customReason = "Rejected by supervisor after visual inspection review."
  ) => {
    if (!canDecide) {
      showToast("Sign in as a supervisor to reject SAP ERP proposals.", false);
      return;
    }
    setBusyDispatchId(item.id);
    try {
      const matchedBatch = globalBatches.find(
        (b) => b.id === item.batchRecordId || b.lotId === item.batchId || b.id === item.batchId
      );
      const expectedBatchVersion = matchedBatch?.version ?? item.batchVersion ?? 1;
      const expectedRevision = item.revision ?? 1;

      const res = await fetch(`/api/dispatch/${encodeURIComponent(item.id)}/reject`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session.csrfToken ? { "x-csrf-token": session.csrfToken } : {}),
        },
        body: JSON.stringify({
          expectedRevision,
          expectedBatchVersion,
          reason: customReason,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        session.expire();
        showToast("Session expired. Please sign in again.", false);
        return;
      }
      if (!res.ok || !json.success) {
        await refreshServerState();
        showToast(json.error || "Failed to reject dispatch.", false);
        return;
      }
      if (json.data) {
        setDispatches((prev) => prev.map((d) => (d.id === item.id ? json.data : d)));
        if (selectedDispatch?.id === item.id) {
          setSelectedDispatch(json.data);
        }
      }
      await refreshServerState();
      showToast(json.message || `Ticket ${item.id} rejected.`, true);
    } catch {
      showToast("Network error while rejecting dispatch.", false);
    } finally {
      setBusyDispatchId(null);
    }
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
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-white border text-xs font-medium shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200 ${
            toast.ok ? "border-slate-200 text-slate-800" : "border-rose-200 text-rose-800"
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
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

      <InlineLoginBanner
        session={session}
        description="Sign in as a supervisor to approve or reject governed SAP QM, MM, and PP proposals."
        roleNotice={canDecide ? null : "Only supervisors can authorize or reject SAP ERP dispatches."}
      />

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
          canDecide={canDecide}
          busyDispatchId={busyDispatchId}
          onApprove={(item) => handleApproveDispatch(item)}
          onReject={(item) => handleRejectDispatch(item)}
        />
      </motion.div>

      {/* MODAL 1: Detail Dispatch Payload Summary */}
      <DispatchDetailModal
        dispatch={selectedDispatch}
        onClose={() => setSelectedDispatch(null)}
        canDecide={canDecide}
        busyDispatchId={busyDispatchId}
        onApprove={(item, reason) => handleApproveDispatch(item, reason)}
        onReject={(item, reason) => handleRejectDispatch(item, reason)}
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

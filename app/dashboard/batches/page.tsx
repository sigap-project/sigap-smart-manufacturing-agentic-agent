"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { BatchStatCards } from "@/components/batches/batch-stat-cards";
import { BatchFilterBar } from "@/components/batches/batch-filter-bar";
import { BatchGridBoard } from "@/components/batches/batch-grid-board";
import { BatchApprovalPanel } from "@/components/batches/batch-approval-panel";
import { BatchDetailDrawer } from "@/components/batches/batch-detail-drawer";
import { InlineLoginBanner } from "@/components/auth/inline-login-banner";
import { BatchStatus, BatchZone } from "@/components/batches/types";
import { useSigapEvents } from "@/hooks/useSigapEvents";
import { useSigapSession } from "@/hooks/useSigapSession";
import { useSigapGlobal, type MutationResult } from "@/context/sigap-global-context";

export default function BatchBoardPage() {
  // Server-authoritative list: the global context polls /api/batches and follows SSE
  const { batches } = useSigapGlobal();
  const session = useSigapSession();
  const canDecide = session.actor?.role === "supervisor";
  const [activeZone, setActiveZone] = useState<BatchZone>("all");
  const [activeStatus, setActiveStatus] = useState<BatchStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvalModeOnly, setApprovalModeOnly] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the drawer bound to the latest server copy of the selected lot
  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const { isConnected } = useSigapEvents({});

  const handleResult = (result: MutationResult) => {
    if (result.status === 401) session.expire();
    const text = result.ok
      ? result.message || "Done."
      : result.code === "VERSION_CONFLICT"
      ? "This lot changed since you opened it. Data refreshed, please try again."
      : result.error || "Request failed.";
    setToast({ ok: result.ok, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  // Filtered batches calculation
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Zone filter
      if (activeZone !== "all" && b.zone !== activeZone) {
        return false;
      }
      // Status filter
      if (activeStatus !== "all" && b.status !== activeStatus) {
        return false;
      }
      // Approval mode filter
      if (approvalModeOnly && b.status !== "pending" && b.status !== "held") {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = b.id.toLowerCase().includes(q);
        const matchesProduct = b.productName.toLowerCase().includes(q);
        const matchesSupplier = b.supplierName.toLowerCase().includes(q);
        if (!matchesId && !matchesProduct && !matchesSupplier) {
          return false;
        }
      }
      return true;
    });
  }, [batches, activeZone, activeStatus, approvalModeOnly, searchQuery]);

  // Batches needing a human decision: undecided or held by an inspection
  const pendingApprovalBatches = useMemo(
    () => batches.filter((b) => b.status === "pending" || b.status === "held"),
    [batches]
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-200">
      {/* Toast Notification Banner (reflects the real server result) */}
      {toast && (
        <div
          role="status"
          className={`fixed top-20 right-6 z-[60] max-w-sm px-4 py-3 rounded-xl bg-white border text-xs shadow-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200 ${
            toast.ok ? "border-slate-200/80 text-slate-800" : "border-rose-200 text-rose-800"
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
              Batch Board &amp; Release Control
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              ERP Dispatch Sync
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-slate-500">
            Real-time lot status tracking, quarantine zone isolation, and Human-in-the-Loop release governance.
          </p>
        </div>

        {/* Action Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs text-slate-600">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-medium">
            <span className="text-slate-400">SLA Queue:</span>
            <span className="text-amber-700 font-semibold">
              {pendingApprovalBatches.length} Active Lots
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-medium">
            <span className="text-slate-400">Telemetry:</span>
            <span className={`font-semibold flex items-center gap-1.5 ${isConnected ? "text-emerald-700" : "text-amber-700"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
              {isConnected ? "SSE Live" : "Connecting..."}
            </span>
          </div>
        </div>
      </motion.div>

      <InlineLoginBanner
        session={session}
        description="Sign in as a supervisor to review inspections and release or reject lots."
        roleNotice={canDecide ? null : "Only supervisors can release or reject lots."}
      />

      {/* Tahap 2: TOP: Stat Row (5 compact cards matching Dashboard style, 150ms - 350ms) */}
      <BatchStatCards batches={batches} />

      {/* Tahap 3A: FILTER BAR: Zone Filter, Status Dropdown, Search, Approval Mode (350ms - 450ms) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative z-20"
      >
        <BatchFilterBar
          activeZone={activeZone}
          onZoneChange={setActiveZone}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          approvalModeOnly={approvalModeOnly}
          onToggleApprovalMode={() => setApprovalModeOnly((prev) => !prev)}
          totalFiltered={filteredBatches.length}
        />
      </motion.div>

      {/* MAIN AREA: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tahap 3B: LEFT COLUMN: Visual Grid Board (450ms - 550ms) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "transform, opacity" }}
          className="lg:col-span-7 xl:col-span-8 relative z-10"
        >
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              Batch Lot Grid ({filteredBatches.length})
            </span>
            <span className="text-xs text-slate-400">
              Click card to inspect lot details
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-dashed border-slate-200 text-center">
              <p className="text-sm font-semibold text-slate-800">No batches in the database yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Seed the database (<code>npm run db:seed</code>) or create a batch through <code>POST /api/batches</code>.
              </p>
            </div>
          ) : (
            <BatchGridBoard
              batches={filteredBatches}
              selectedBatch={selectedBatch}
              onSelectBatch={(batch) => setSelectedBatchId(batch.id)}
            />
          )}
        </motion.div>

        {/* Tahap 4: RIGHT COLUMN (30-35% on XL): "Menunggu Persetujuan" Panel (550ms - 750ms) */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.58, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: "transform, opacity" }}
          className="lg:col-span-5 xl:col-span-4 sticky top-24"
        >
          <BatchApprovalPanel
            pendingBatches={pendingApprovalBatches}
            onInspectBatch={(batch) => setSelectedBatchId(batch.id)}
          />
        </motion.div>
      </div>

      {/* Slide-over Drawer for Selected Batch Detail */}
      <BatchDetailDrawer
        batch={selectedBatch}
        onClose={() => setSelectedBatchId(null)}
        canDecide={canDecide}
        csrfToken={session.csrfToken}
        onResult={handleResult}
      />
    </div>
  );
}

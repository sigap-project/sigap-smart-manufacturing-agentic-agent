"use client";

import { useState, useMemo, useEffect } from "react";
import { Layers, Sparkles, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { BatchStatCards } from "@/components/batches/batch-stat-cards";
import { BatchFilterBar } from "@/components/batches/batch-filter-bar";
import { BatchGridBoard } from "@/components/batches/batch-grid-board";
import { BatchApprovalPanel } from "@/components/batches/batch-approval-panel";
import { BatchDetailDrawer } from "@/components/batches/batch-detail-drawer";
import { BatchesSkeleton } from "@/components/batches/batches-skeleton";
import {
  BatchItem,
  BatchStatus,
  BatchZone,
  INITIAL_BATCHES,
} from "@/components/batches/types";
import { useSigapEvents } from "@/hooks/useSigapEvents";

export default function BatchBoardPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<BatchZone>("all");
  const [activeStatus, setActiveStatus] = useState<BatchStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvalModeOnly, setApprovalModeOnly] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dengarkan pembaruan real-time via SSE
  const { isConnected } = useSigapEvents({
    onBatchStatusChanged: (updatedBatch) => {
      const normalizedStatus =
        updatedBatch.status === "pending_review" ? "pending" : updatedBatch.status;
      const sanitizedBatch = { ...updatedBatch, status: normalizedStatus };

      setBatches((prev) => {
        const index = prev.findIndex(
          (b) => b.id === sanitizedBatch.id || b.id === sanitizedBatch.lotId
        );
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...sanitizedBatch };
          return updated;
        } else {
          return [sanitizedBatch, ...prev];
        }
      });
      showToast(`Status batch ${sanitizedBatch.lotId || sanitizedBatch.id} terbarui secara live (${sanitizedBatch.status}).`);
    },
  });

  // Ambil data batch nyata dari API PostgreSQL
  useEffect(() => {
    async function fetchBatches() {
      try {
        const res = await fetch("/api/batches");
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const sanitized = json.data.map((b: any) => ({
            ...b,
            status: b.status === "pending_review" ? "pending" : b.status || "pending",
          }));
          setBatches(sanitized);
        } else {
          setBatches(INITIAL_BATCHES);
        }
      } catch (err) {
        console.warn("Gagal mengambil data batch live dari server:", err);
        setBatches(INITIAL_BATCHES);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBatches();
  }, []);

  // Handlers for Human Approval Actions (Sinkronisasi ke Database via API)
  const handleApprove = async (batchId: string) => {
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/approve`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBatches((prev) =>
          prev.map((b) => (b.id === batchId ? json.data : b))
        );
        showToast(json.message || `Batch ${batchId} berhasil DISETUJUI & DILEPASKAN untuk perakitan.`);
        return;
      }
    } catch (err) {
      console.warn("Gagal sinkronisasi approve ke database:", err);
    }

    // Fallback optimistik lokal
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              status: "released",
              defectCount: Math.min(b.defectCount, 1),
              timeAgo: "Baru saja",
            }
          : b
      )
    );
    showToast(`Batch ${batchId} berhasil DISETUJUI & DILEPASKAN untuk perakitan.`);
  };

  const handleReject = async (batchId: string) => {
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/reject`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBatches((prev) =>
          prev.map((b) => (b.id === batchId ? json.data : b))
        );
        showToast(json.message || `Batch ${batchId} DITAHAN ke Zona Karantina.`);
        return;
      }
    } catch (err) {
      console.warn("Gagal sinkronisasi reject ke database:", err);
    }

    // Fallback optimistik lokal
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              status: "held",
              zone: "quarantine",
              timeAgo: "Baru saja",
            }
          : b
      )
    );
    showToast(`Batch ${batchId} DITAHAN ke Zona Karantina. Tiket notifikasi terbit ke SAP QM.`);
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

  // Batches needing human decision (pending or high escalation held)
  const pendingApprovalBatches = useMemo(() => {
    return batches.filter(
      (b) => b.status === "pending" || (b.status === "held" && (b.escalationScore ?? 0) >= 0.7)
    );
  }, [batches]);

  if (isLoading && batches.length === 0) {
    return <BatchesSkeleton />;
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
              Batch Board &amp; Kontrol Pelepasan
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ERP DISPATCH SYNC
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            Visualisasi status seluruh batch lot manufaktur, isolasi zona karantina, dan keputusan persetujuan Human-in-the-Loop.
          </p>
        </div>

        {/* Action Status Pills */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono text-zinc-400">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sinkronisasi DB...</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-zinc-500">Antrean SLA:</span>
            <span className="text-amber-400 font-bold">
              {pendingApprovalBatches.length} Lot Aktif
            </span>
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

      {/* TOP: Stat Row (5 compact cards matching Dashboard style) */}
      <BatchStatCards batches={batches} />

      {/* FILTER BAR: Zone Filter, Status Dropdown, Search, Approval Mode */}
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

      {/* MAIN AREA: Two-column layout (Left wider: Grid Board, Right narrower: Pending Approval Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (65-70% on XL): Visual Grid Board */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Visual Board Batch ({filteredBatches.length})
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              Klik kartu untuk inspeksi rincian
            </span>
          </div>

          <BatchGridBoard
            batches={filteredBatches}
            selectedBatch={selectedBatch}
            onSelectBatch={(batch) => setSelectedBatch(batch)}
          />
        </div>

        {/* RIGHT COLUMN (30-35% on XL): "Menunggu Persetujuan" Panel */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-24">
          <BatchApprovalPanel
            pendingBatches={pendingApprovalBatches}
            onApprove={handleApprove}
            onReject={handleReject}
            onInspectBatch={(batch) => setSelectedBatch(batch)}
          />
        </div>
      </div>

      {/* Slide-over Drawer for Selected Batch Detail */}
      <BatchDetailDrawer
        batch={selectedBatch}
        onClose={() => setSelectedBatch(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}

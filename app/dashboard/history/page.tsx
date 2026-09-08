"use client";

import { useState, useMemo, useEffect } from "react";
import { Clock, Download, CheckCircle2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { HistoryFilterBar } from "@/components/history/history-filter-bar";
import { HistoryTable } from "@/components/history/history-table";
import { HistoryDetailModal } from "@/components/history/history-detail-modal";
import { HistorySkeleton } from "@/components/history/history-skeleton";
import {
  DefectClass,
  InspectionRecord,
  InspectionStatus,
  INITIAL_INSPECTIONS,
} from "@/components/history/types";

export default function LotHistoryPage() {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | "all">("all");
  const [defectFilter, setDefectFilter] = useState<DefectClass | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ambil data inspeksi nyata dari API PostgreSQL
  useEffect(() => {
    async function fetchInspections() {
      try {
        const res = await fetch("/api/inspections?limit=100");
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setInspections(json.data);
        } else {
          setInspections(INITIAL_INSPECTIONS);
        }
      } catch (err) {
        console.warn("Gagal mengambil data inspeksi live dari server:", err);
        setInspections(INITIAL_INSPECTIONS);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInspections();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter logic
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      // Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      // Defect class filter
      if (defectFilter !== "all" && item.defectClass !== defectFilter) {
        return false;
      }
      // Date range filter
      if (dateRange === "today") {
        if (!item.rawDate.startsWith("2026-09-08")) return false;
      } else if (dateRange === "7d") {
        if (!item.rawDate.startsWith("2026-09")) return false;
      }
      // Search query (batch ID, part name, inspection ID, supplier)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesBatch = item.batchId.toLowerCase().includes(q);
        const matchesPart = item.partName.toLowerCase().includes(q);
        const matchesSupplier = item.supplier.toLowerCase().includes(q);
        if (!matchesId && !matchesBatch && !matchesPart && !matchesSupplier) {
          return false;
        }
      }
      return true;
    });
  }, [inspections, statusFilter, defectFilter, dateRange, searchQuery]);

  // Real CSV Export Handler
  const handleExportCsv = () => {
    if (filteredInspections.length === 0) {
      showToast("Tidak ada rekaman untuk diekspor.");
      return;
    }

    const headers = [
      "Inspection ID",
      "Defect Class",
      "Confidence (%)",
      "Batch ID",
      "Komponen",
      "Supplier",
      "Conveyor Line",
      "Timestamp",
      "Status",
      "Dispatch ID",
    ];

    const rows = filteredInspections.map((r) => [
      `"${r.id}"`,
      `"${r.defectClass}"`,
      r.confidence,
      `"${r.batchId}"`,
      `"${r.partName}"`,
      `"${r.supplier}"`,
      `"${r.line}"`,
      `"${r.timestamp}"`,
      `"${r.status}"`,
      `"${r.dispatchId || "-"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `SIGAP_Lot_History_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(
      `Berhasil mengekspor ${filteredInspections.length} rekaman inspeksi ke file CSV.`
    );
  };

  if (isLoading && inspections.length === 0) {
    return <HistorySkeleton />;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
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
              Riwayat Lot &amp; Jejak Inspeksi
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              TRACEABILITY AUDIT LOG
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            Arsip riwayat pengujian optik per unit/lot, bukti citra frame cacat, dan jejak penalaran agen otonom.
          </p>
        </div>

        {/* Action Button & Metadata */}
        <div className="flex items-center gap-3 shrink-0">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Memuat Riwayat...</span>
            </div>
          )}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-emerald-500/15 border border-white/[0.12] hover:border-emerald-500/40 text-zinc-200 hover:text-emerald-300 font-mono text-xs font-semibold transition-all duration-200 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV ({filteredInspections.length})</span>
          </button>
        </div>
      </div>

      {/* TOP FILTER BAR: Date Range, Status Filter, Defect Class, Batch Search Input */}
      <HistoryFilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        defectFilter={defectFilter}
        onDefectFilterChange={setDefectFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* MAIN TABLE: Inspection Rows with Pagination & Detail Modal Trigger */}
      <HistoryTable
        inspections={filteredInspections}
        onViewDetail={(record) => setSelectedRecord(record)}
        onExportCsv={handleExportCsv}
      />

      {/* INSPECTION DETAIL MODAL: Larger Image, Agent Reasoning Trace, Related Dispatch Link */}
      <HistoryDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

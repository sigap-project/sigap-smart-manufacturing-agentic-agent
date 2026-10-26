"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, CheckCircle2, Loader2 } from "lucide-react";
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
import { useSigapGlobal } from "@/context/sigap-global-context";

export default function LotHistoryPage() {
  const { inspections: globalInspections } = useSigapGlobal();
  const [inspections, setInspections] = useState<InspectionRecord[]>(globalInspections);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | "all">("all");
  const [defectFilter, setDefectFilter] = useState<DefectClass | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync with global context inspections when updated
  useEffect(() => {
    if (globalInspections && globalInspections.length > 0) {
      setInspections(globalInspections);
    }
  }, [globalInspections]);

  // Ambil data inspeksi nyata dari API PostgreSQL
  useEffect(() => {
    async function fetchInspections() {
      try {
        const res = await fetch("/api/inspections?limit=100");
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setInspections(json.data);
        }
      } catch (err) {
        console.warn("Failed fetching live inspection records:", err);
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
      // Status filter (handle English vs DB values)
      if (statusFilter !== "all") {
        if (statusFilter === "Passed" && item.status !== "Passed" && item.status !== "Lolos QC") return false;
        if (statusFilter === "Held" && item.status !== "Held" && item.status !== "Ditahan") return false;
        if (statusFilter === "Pending Review" && item.status !== "Pending Review") return false;
        if (statusFilter === "Rejected" && item.status !== "Rejected" && item.status !== "Ditolak") return false;
      }
      // Defect class filter
      if (defectFilter !== "all" && item.defectClass !== defectFilter) {
        return false;
      }
      // Date range filter (supports today's real timestamp and sample mock data)
      if (dateRange === "today") {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!item.rawDate.startsWith(todayStr) && !item.rawDate.startsWith("2026-09-08")) return false;
      } else if (dateRange === "7d") {
        const now = Date.now();
        const itemTime = new Date(item.rawDate).getTime();
        const isRecent = !isNaN(itemTime) && now - itemTime <= 7 * 24 * 60 * 60 * 1000;
        if (!isRecent && !item.rawDate.startsWith("2026-09")) return false;
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
      showToast("No records available to export.");
      return;
    }

    const headers = [
      "Inspection ID",
      "Defect Class",
      "Confidence (%)",
      "Batch ID",
      "Component",
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
      `Successfully exported ${filteredInspections.length} inspection records to CSV.`
    );
  };

  if (isLoading && inspections.length === 0) {
    return <HistorySkeleton />;
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

      {/* Page Title & Context Header */}
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
              Lot History &amp; Traceability
            </h1>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Audit Trail Verified
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Historical archive of optical batch inspections, bounding box captures, and autonomous agent reasoning decisions.
          </p>
        </div>

        {/* Action Button & Metadata */}
        <div className="flex items-center gap-3 shrink-0">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Fetching Records...</span>
            </div>
          )}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV ({filteredInspections.length})</span>
          </button>
        </div>
      </motion.div>

      {/* TOP FILTER BAR: Segmented Date Range, Status Filter, Defect Class, Batch Search Input */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.20, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative z-20"
      >
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
      </motion.div>

      {/* MAIN TABLE: Inspection Rows with Pagination & Detail Modal Trigger */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative z-10"
      >
        <HistoryTable
          inspections={filteredInspections}
          onViewDetail={(record) => setSelectedRecord(record)}
          onExportCsv={handleExportCsv}
        />
      </motion.div>

      {/* INSPECTION DETAIL MODAL: Camera Snapshot, Agent Reasoning Trace, Related Dispatch Link */}
      <HistoryDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

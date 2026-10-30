"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { InlineLoginBanner } from "@/components/auth/inline-login-banner";
import { useSigapSession } from "@/hooks/useSigapSession";
import { InspectionCameraPanel } from "@/components/inspection/inspection-camera-panel";
import { InspectionEventsList } from "@/components/inspection/inspection-events-list";
import { InspectionAgentTrace } from "@/components/inspection/inspection-agent-trace";
import { useSigapGlobal } from "@/context/sigap-global-context";
import { BrowserInspectionResult } from "@/lib/contracts";
import type { InspectionRecord } from "@/components/history/types";

interface InspectionViewClientProps {
  initialBatchId: string | null;
  activeLot: string | null;
  activePart: string | null;
  escalationScore: number | null;
}

export function InspectionViewClient({
  initialBatchId,
  activeLot,
  activePart,
}: InspectionViewClientProps) {
  const { batches, inspections, applyInspectionSnapshot } = useSigapGlobal();

  const session = useSigapSession();
  const { actor: sessionActor, csrfToken } = session;

  // Batch & Workpiece Selection State
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId);
  const [itemId, setItemId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Selected / Analyzed Inspection State
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // Sync selectedBatchId with available batches when initialBatchId wasn't found
  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].batchId || batches[0].id);
    }
  }, [batches, selectedBatchId]);

  // Find effective selected batch record
  const currentBatch = useMemo(() => {
    if (batches.length === 0) return null;
    return (
      batches.find((b) => (b.batchId || b.id) === selectedBatchId) || batches[0]
    );
  }, [batches, selectedBatchId]);

  const effectiveBatchId = currentBatch?.batchId || currentBatch?.id || null;
  const currentLotId = currentBatch?.lotId || activeLot || "#B-PENDING";
  const currentProductType =
    currentBatch?.productType || activePart || "Submersible Pump Impeller Casting";

  const canAnalyze = Boolean(
    sessionActor && (sessionActor.role === "operator" || sessionActor.role === "supervisor")
  );

  const handleInputChange = useCallback(() => {
    setSelectedInspectionId(null);
  }, []);

  const handleAnalysisComplete = useCallback(
    (data: BrowserInspectionResult) => {
      if (!data || !data.inspection) return;
      setSelectedInspectionId(data.inspection.id);
      applyInspectionSnapshot(data.inspection);
    },
    [applyInspectionSnapshot]
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
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
              Optical Inspection &amp; AI Reasoning
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Image &amp; Webcam Inspection
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-slate-500">
            Dedicated vision inspection station for submersible pump impeller castings with local webcam and single-image uploads.
          </p>
        </div>

        {/* Current Active Lot and Part */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs text-slate-600">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-medium">
            <span className="text-slate-400">Lot:</span>
            <span className="text-slate-900 font-semibold">{currentLotId}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-medium">
            <span className="text-slate-400">Target:</span>
            <span className="text-slate-900 font-semibold truncate max-w-[200px]">
              {currentProductType}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Two-Column Split Layout (60% Left, 40% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (60%): Context Selector & Inspection Panel */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">
          {/* Inline Auth / Session Banner */}
          <InlineLoginBanner
            session={session}
            description="Sign in with operator or supervisor credentials to analyze castings."
            roleNotice={canAnalyze ? null : "Viewer role cannot run server analysis."}
          />

          {/* Batch Selector & Item ID Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            {/* Batch Selector */}
            <div>
              <label htmlFor="batch-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Batch Lot <span className="text-rose-500">*</span>
              </label>
              {batches.length === 0 ? (
                <div className="text-xs text-amber-700 flex items-center gap-1.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>No batch available.</span>
                  <Link href="/dashboard/batches" className="underline font-semibold hover:text-amber-800">
                    Go to Batches
                  </Link>
                </div>
              ) : (
                <select
                  id="batch-select"
                  value={selectedBatchId || ""}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    handleInputChange();
                  }}
                  disabled={isAnalyzing}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  {batches.map((b) => (
                    <option key={b.batchId || b.id} value={b.batchId || b.id}>
                      {b.lotId || b.id} — {b.productType || b.productName || "Impeller Casting"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Item ID Input */}
            <div>
              <label htmlFor="item-id-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Workpiece Item ID <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="item-id-input"
                type="text"
                placeholder={`Auto-assigned (${currentLotId}-001…)`}
                value={itemId}
                maxLength={64}
                onChange={(e) => {
                  setItemId(e.target.value);
                  handleInputChange();
                }}
                disabled={isAnalyzing}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Leave blank to auto-assign the next ID in this lot, or enter a barcode/serial to override.
              </p>
            </div>
          </div>

          {/* Camera & Upload Panel */}
          <InspectionCameraPanel
            batchId={effectiveBatchId}
            lotId={currentLotId}
            productType={currentProductType}
            itemId={itemId}
            csrfToken={csrfToken}
            canAnalyze={canAnalyze}
            onAnalysisComplete={handleAnalysisComplete}
            onInputChange={handleInputChange}
            onSessionExpired={session.expire}
            onAnalyzingChange={setIsAnalyzing}
          />
        </div>

        {/* RIGHT COLUMN (40%): Stacked Events, Trace, and Escalation Gauge */}
        <div className="min-w-0 lg:col-span-5 xl:col-span-5 space-y-6">
          {/* Recent Events List */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <InspectionEventsList events={inspections} />
          </motion.div>

          {/* Agent Reasoning Trace */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <InspectionAgentTrace inspectionId={selectedInspectionId || undefined} />
          </motion.div>

        </div>
      </div>
    </div>
  );
}

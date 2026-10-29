"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { InspectionCameraPanel } from "@/components/inspection/inspection-camera-panel";
import { InspectionEventsList } from "@/components/inspection/inspection-events-list";
import { InspectionAgentTrace } from "@/components/inspection/inspection-agent-trace";
import { InspectionEscalationGauge } from "@/components/inspection/inspection-escalation-gauge";
import { useSigapGlobal } from "@/context/sigap-global-context";
import { BrowserInspectionResult } from "@/lib/contracts";
import type { InspectionRecord } from "@/components/history/types";

interface InspectionViewClientProps {
  initialBatchId: string | null;
  activeLot: string | null;
  activePart: string | null;
  escalationScore: number | null;
}

interface SessionActor {
  id: string;
  role: string;
}

export function InspectionViewClient({
  initialBatchId,
  activeLot,
  activePart,
  escalationScore: initialScore,
}: InspectionViewClientProps) {
  const { batches, inspections, applyInspectionSnapshot } = useSigapGlobal();

  // Authentication State
  const [sessionActor, setSessionActor] = useState<SessionActor | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Batch & Workpiece Selection State
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId);
  const [itemId, setItemId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Selected / Analyzed Inspection State
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // Fetch Session on Mount
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSessionActor(json.data.actor);
          setCsrfToken(json.data.csrfToken);
        }
      } else {
        setSessionActor(null);
        setCsrfToken(null);
      }
    } catch {
      setSessionActor(null);
      setCsrfToken(null);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

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

  const effectiveEscalationScore = useMemo(() => {
    if (currentBatch && typeof currentBatch.escalationScore === "number") {
      return currentBatch.escalationScore;
    }
    return initialScore;
  }, [currentBatch, initialScore]);

  const canAnalyze = Boolean(
    sessionActor && (sessionActor.role === "operator" || sessionActor.role === "supervisor")
  );

  // Inline Login Handler
  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUserId || !loginPassword || loginBusy) return;

    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: loginUserId.trim(), password: loginPassword }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setSessionActor(json.data.actor);
        setCsrfToken(json.data.csrfToken);
        setLoginPassword("");
        setLoginError(null);
      } else {
        setLoginError(json.error || "Invalid user ID or password.");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSessionExpired = useCallback(() => {
    setSessionActor(null);
    setCsrfToken(null);
  }, []);

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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 select-none">
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
          {!sessionActor ? (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Operator Authentication Required
                  </span>
                </div>
                <p className="text-xs text-amber-700 mt-0.5">
                  Sign in with operator or supervisor credentials to analyze castings.
                </p>
                {loginError && <p className="text-xs font-semibold text-rose-600 mt-1">{loginError}</p>}
              </div>

              <form onSubmit={handleInlineLogin} className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="User ID"
                  aria-label="User ID"
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  className="w-28 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loginBusy}
                />
                <input
                  type="password"
                  placeholder="Password"
                  aria-label="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-28 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loginBusy}
                />
                <button
                  type="submit"
                  disabled={loginBusy || !loginUserId || !loginPassword}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  {loginBusy ? "Signing in…" : "Sign In"}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Active session:</span>
                <span className="font-semibold text-slate-900">{sessionActor.id}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold uppercase">
                  {sessionActor.role}
                </span>
              </div>
              {!canAnalyze && (
                <span className="text-amber-700 text-[11px] font-medium">
                  Viewer role cannot run server analysis.
                </span>
              )}
            </div>
          )}

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
                Workpiece Item ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="item-id-input"
                type="text"
                placeholder="e.g. IMP-001, CAST-8842"
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
                Each workpiece requires a unique identifier within its lot batch.
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
            onSessionExpired={handleSessionExpired}
            onAnalyzingChange={setIsAnalyzing}
          />
        </div>

        {/* RIGHT COLUMN (40%): Stacked Events, Trace, and Escalation Gauge */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6">
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

          {/* Escalation Score Gauge */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            {effectiveEscalationScore !== null && effectiveEscalationScore !== undefined ? (
              <InspectionEscalationGauge
                score={effectiveEscalationScore}
                lotId={`Lot ${currentLotId}`}
                partName={currentProductType}
              />
            ) : (
              <div className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center py-10 select-none">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <Zap className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Awaiting Escalation Metric</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                  Escalation score will display once defect metrics or policy calculations are recorded for this batch.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

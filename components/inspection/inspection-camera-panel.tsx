"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  VideoOff,
  FileImage,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { BrowserInspectionResult } from "@/lib/contracts";

export interface InspectionCameraPanelProps {
  batchId: string | null;
  lotId: string;
  productType: string;
  itemId: string;
  csrfToken: string | null;
  canAnalyze: boolean;
  onAnalysisComplete: (data: BrowserInspectionResult) => void;
  onInputChange: () => void;
  onSessionExpired: () => void;
  onAnalyzingChange: (busy: boolean) => void;
}

interface NormalizedImage {
  dataUrl: string;
  jpegBase64: string;
  width: number;
  height: number;
}

interface InspectionDisplayResult {
  outcome: "ok" | "defect" | "unknown";
  defectClass: string;
  confidence: number | null;
  boundingBoxes: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  localizationStatus: "completed" | "skipped" | "failed";
}

interface RequestIdentity {
  eventId: string;
  batchId: string;
  itemId: string;
  capturedAt: string;
  captureSource: "browser-upload" | "browser-webcam";
  jpegBase64: string;
}

/**
 * Aspect-preserving resize into 1920x1080 without upscaling,
 * white background for alpha, JPEG quality 0.9.
 */
function normalizeCanvasToJpeg(
  sourceCanvas: HTMLCanvasElement,
  srcW: number,
  srcH: number
): NormalizedImage {
  let targetW = srcW;
  let targetH = srcH;

  if (targetW > 1920 || targetH > 1080) {
    const scale = Math.min(1920 / targetW, 1080 / targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }

  // White background for alpha transparency
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);

  const dataUrl = outCanvas.toDataURL("image/jpeg", 0.9);
  const commaIdx = dataUrl.indexOf(",");
  const jpegBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  const approxBytes = Math.round((jpegBase64.length * 3) / 4);
  if (approxBytes > 1048576) {
    throw new Error("Image is too large after conversion. Choose a smaller image.");
  }

  return {
    dataUrl,
    jpegBase64,
    width: targetW,
    height: targetH,
  };
}

async function normalizeFile(file: File): Promise<NormalizedImage> {
  const { promise: dataUrlPromise, resolve: resolveDataUrl, reject: rejectDataUrl } =
    Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = () => resolveDataUrl(reader.result as string);
  reader.onerror = () => rejectDataUrl(new Error(`Failed to read file ${file.name}`));
  reader.readAsDataURL(file);
  const dataUrl = await dataUrlPromise;

  const { promise: imgPromise, resolve: resolveImg, reject: rejectImg } =
    Promise.withResolvers<HTMLImageElement>();
  const i = new Image();
  i.onload = () => resolveImg(i);
  i.onerror = () => rejectImg(new Error(`Failed to decode image from ${file.name}`));
  i.src = dataUrl;
  const img = await imgPromise;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to initialize canvas");
  ctx.drawImage(img, 0, 0);

  return normalizeCanvasToJpeg(canvas, img.naturalWidth, img.naturalHeight);
}

export function InspectionCameraPanel({
  batchId,
  lotId,
  productType,
  itemId,
  csrfToken,
  canAnalyze,
  onAnalysisComplete,
  onInputChange,
  onSessionExpired,
  onAnalyzingChange,
}: InspectionCameraPanelProps) {
  // Tab Mode
  const [activeTab, setActiveTab] = useState<"upload" | "webcam">("upload");

  // Upload State
  const [uploadState, setUploadState] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [normalizedUpload, setNormalizedUpload] = useState<NormalizedImage | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Webcam State
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [webcamSnapshot, setWebcamSnapshot] = useState<NormalizedImage | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Analysis & Submission State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<InspectionDisplayResult | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const selectionTokenRef = useRef(0);
  const acquisitionTokenRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdentityRef = useRef<RequestIdentity | null>(null);

  // Stop all camera tracks
  const stopCameraStream = useCallback(() => {
    acquisitionTokenRef.current++;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("idle");
    setIsVideoReady(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [stopCameraStream]);

  // Handle Tab Switch
  const handleTabSwitch = (tab: "upload" | "webcam") => {
    if (isAnalyzing) return;
    if (tab === "upload" && cameraStatus === "live") {
      stopCameraStream();
    }
    setActiveTab(tab);
  };

  // Determine unmet analysis prerequisite message
  const getUnmetPrerequisite = useCallback((): string | null => {
    if (!canAnalyze) {
      return "Sign in with operator or supervisor credentials to analyze";
    }
    if (!batchId) {
      return "Select an active batch to analyze";
    }
    if (!itemId || !itemId.trim()) {
      return "Enter a Workpiece Item ID to analyze";
    }
    return null;
  }, [canAnalyze, batchId, itemId]);

  const unmetReason = getUnmetPrerequisite();
  const isReadyToAnalyze = !unmetReason;

  // Process File Selection
  const processSelectedFile = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError(`Unsupported format '${file.type || "unknown"}'. Please upload JPG, PNG, or WebP.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`File '${file.name}' exceeds 10 MiB limit.`);
      return;
    }

    const currentToken = ++selectionTokenRef.current;
    onInputChange();
    setLastResult(null);
    setAnalysisError(null);
    requestIdentityRef.current = null;
    setUploadState("loading");
    setUploadError(null);

    try {
      const normalized = await normalizeFile(file);
      if (selectionTokenRef.current !== currentToken) return;

      setNormalizedUpload(normalized);
      setSelectedFileName(file.name);
      setUploadState("ready");
    } catch (err) {
      if (selectionTokenRef.current !== currentToken) return;
      const msg = err instanceof Error ? err.message : "Failed to process image";
      setUploadError(`Error loading '${file.name}': ${msg}`);
      if (!normalizedUpload) {
        setUploadState("error");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAnalyzing) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isAnalyzing) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      setUploadError("Please upload one image at a time.");
      return;
    }

    processSelectedFile(files[0]);
  };

  // Submit to Server Analysis Route
  const executeAnalysis = async (
    source: "browser-upload" | "browser-webcam",
    jpegBase64: string
  ) => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsAnalyzing(true);
    onAnalyzingChange(true);
    setAnalysisError(null);

    // Reuse request identity on retry or create new
    let reqPayload = requestIdentityRef.current;
    if (
      !reqPayload ||
      reqPayload.batchId !== batchId ||
      reqPayload.itemId !== itemId.trim() ||
      reqPayload.captureSource !== source ||
      reqPayload.jpegBase64 !== jpegBase64
    ) {
      reqPayload = {
        eventId: crypto.randomUUID(),
        batchId: batchId!,
        itemId: itemId.trim(),
        capturedAt: new Date().toISOString(),
        captureSource: source,
        jpegBase64,
      };
      requestIdentityRef.current = reqPayload;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/inspection/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify(reqPayload),
        signal: controller.signal,
      });

      if (response.status === 401) {
        onSessionExpired();
        setAnalysisError("Session expired. Please sign in again.");
        return;
      }

      const json = await response.json();
      if (!response.ok || !json.success) {
        setAnalysisError(json.error || `Analysis failed (${response.status})`);
        return;
      }

      const resultData = json.data as BrowserInspectionResult;
      const ins = resultData.inspection;

      setLastResult({
        outcome: (ins.outcome as "ok" | "defect" | "unknown") || "unknown",
        defectClass: ins.defectClass || (ins.outcome === "defect" ? "defect" : "OK"),
        confidence: ins.confidence ?? null,
        boundingBoxes: (ins.boundingBoxes || []).map((b) => ({
          id: b.id || "box",
          label: b.label || "defect",
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          confidence: b.confidence ?? 0,
        })),
        localizationStatus: (ins.localizationStatus as "completed" | "skipped" | "failed") || "skipped",
      });

      onAnalysisComplete(resultData);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setAnalysisError(err instanceof Error ? err.message : "Network error during analysis");
    } finally {
      submitInFlightRef.current = false;
      setIsAnalyzing(false);
      onAnalyzingChange(false);
      abortControllerRef.current = null;
    }
  };

  // Start Camera
  const handleStartCamera = async () => {
    if (isAnalyzing || cameraStatus === "starting") return;
    setCameraStatus("starting");
    setCameraError(null);
    const token = ++acquisitionTokenRef.current;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus("error");
      setCameraError("Camera access requires HTTPS or localhost context.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (acquisitionTokenRef.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (acquisitionTokenRef.current === token) {
            setIsVideoReady(true);
            setCameraStatus("live");
          }
        };
      }
    } catch (err: unknown) {
      if (acquisitionTokenRef.current !== token) return;
      setCameraStatus("error");
      const errorName = err instanceof Error ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in browser settings.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setCameraError("No camera found on this device.");
      } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
        setCameraError("Camera is currently in use by another application.");
      } else {
        setCameraError(err instanceof Error ? err.message : "Failed to access camera.");
      }
    }
  };

  // Capture Picture from Video Feed
  const handleTakePicture = async () => {
    if (!videoRef.current || !isReadyToAnalyze || isAnalyzing) return;
    const v = videoRef.current;
    if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || v.videoWidth <= 0 || v.videoHeight <= 0) {
      return;
    }

    onInputChange();
    setLastResult(null);
    setAnalysisError(null);
    requestIdentityRef.current = null;

    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);

    try {
      const normalized = normalizeCanvasToJpeg(canvas, v.videoWidth, v.videoHeight);
      setWebcamSnapshot(normalized);
      await executeAnalysis("browser-webcam", normalized.jpegBase64);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to process snapshot");
    }
  };

  // Take Another Picture (return to live feed)
  const handleTakeAnotherPicture = () => {
    if (isAnalyzing) return;
    setWebcamSnapshot(null);
    setLastResult(null);
    setAnalysisError(null);
    onInputChange();
    if (cameraStatus === "idle") {
      handleStartCamera();
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl">
          <button
            type="button"
            onClick={() => handleTabSwitch("upload")}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "upload"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            } ${isAnalyzing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("webcam")}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "webcam"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            } ${isAnalyzing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Local Webcam</span>
          </button>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2 text-xs">
          {isAnalyzing ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Analyzing…</span>
            </span>
          ) : lastResult ? (
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border ${
                lastResult.outcome === "ok"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : lastResult.outcome === "defect"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {lastResult.outcome === "ok" ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-rose-600" />
              )}
              <span className="capitalize">{lastResult.outcome === "unknown" ? "Needs review" : lastResult.outcome}</span>
              <span>•</span>
              <span>{lastResult.confidence !== null ? `${lastResult.confidence}%` : "—"}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="p-5 space-y-4">
        {/* TAB 1: UPLOAD IMAGE */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose image file"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Media Container */}
            {uploadState === "ready" && normalizedUpload ? (
              <div
                className="w-full relative bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center"
                style={{
                  aspectRatio: `${normalizedUpload.width} / ${normalizedUpload.height}`,
                  maxHeight: "560px",
                }}
              >
                <svg
                  viewBox={`0 0 ${normalizedUpload.width} ${normalizedUpload.height}`}
                  className="w-full h-full block"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <image
                    href={normalizedUpload.dataUrl}
                    width={normalizedUpload.width}
                    height={normalizedUpload.height}
                  />
                  {lastResult?.outcome === "defect" &&
                    lastResult.boundingBoxes.map((box, idx) => {
                      const bx = (box.x / 100) * normalizedUpload.width;
                      const by = (box.y / 100) * normalizedUpload.height;
                      const bw = (box.width / 100) * normalizedUpload.width;
                      const bh = (box.height / 100) * normalizedUpload.height;
                      return (
                        <g key={box.id || idx}>
                          <rect
                            x={bx}
                            y={by}
                            width={bw}
                            height={bh}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={Math.max(2, normalizedUpload.width / 320)}
                          />
                          <rect
                            x={bx}
                            y={Math.max(0, by - 20)}
                            width={Math.max(50, bw * 0.45)}
                            height={18}
                            fill="#ef4444"
                            rx={2}
                          />
                          <text
                            x={bx + 4}
                            y={Math.max(12, by - 6)}
                            fill="#ffffff"
                            fontSize={11}
                            fontWeight="600"
                            fontFamily="sans-serif"
                          >
                            {box.confidence ? `defect ${Math.round(box.confidence)}%` : "defect"}
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>
            ) : uploadState === "loading" ? (
              <div className="w-full h-64 sm:h-80 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2.5 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Loading image…</span>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full h-64 sm:h-80 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50/50"
                    : uploadState === "error"
                    ? "border-rose-300 bg-rose-50/30"
                    : "border-slate-200 bg-slate-50/70 hover:bg-slate-50"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-3 text-slate-600">
                  <FileImage className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Upload an image</h4>
                <p className="text-xs text-slate-500 mb-4 max-w-sm">
                  Drag and drop a JPG, PNG or WebP here
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Choose Image
                </button>
                <span className="text-[11px] text-slate-400 mt-3">One image, up to 10 MiB</span>
              </div>
            )}

            {/* Error Message if any */}
            {uploadError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-semibold">Image loading error</p>
                  <p className="mt-0.5 text-rose-700">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                >
                  Choose Image
                </button>
                {selectedFileName && (
                  <span className="text-xs text-slate-500 truncate max-w-[220px]">
                    {selectedFileName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => normalizedUpload && executeAnalysis("browser-upload", normalizedUpload.jpegBase64)}
                  disabled={uploadState !== "ready" || !isReadyToAnalyze || isAnalyzing}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                    uploadState === "ready" && isReadyToAnalyze && !isAnalyzing
                      ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  }`}
                >
                  {isAnalyzing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isAnalyzing ? "Analyzing…" : "Analyze Image"}</span>
                </button>
              </div>
            </div>

            {/* Unmet prerequisite notice */}
            {uploadState === "ready" && unmetReason && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{unmetReason}</span>
              </p>
            )}
          </div>
        )}

        {/* TAB 2: LOCAL WEBCAM */}
        {activeTab === "webcam" && (
          <div className="space-y-4">
            {/* Media Viewport */}
            {webcamSnapshot ? (
              // Snapshot Still View
              <div
                className="w-full relative bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center"
                style={{
                  aspectRatio: `${webcamSnapshot.width} / ${webcamSnapshot.height}`,
                  maxHeight: "560px",
                }}
              >
                <svg
                  viewBox={`0 0 ${webcamSnapshot.width} ${webcamSnapshot.height}`}
                  className="w-full h-full block"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <image
                    href={webcamSnapshot.dataUrl}
                    width={webcamSnapshot.width}
                    height={webcamSnapshot.height}
                  />
                  {lastResult?.outcome === "defect" &&
                    lastResult.boundingBoxes.map((box, idx) => {
                      const bx = (box.x / 100) * webcamSnapshot.width;
                      const by = (box.y / 100) * webcamSnapshot.height;
                      const bw = (box.width / 100) * webcamSnapshot.width;
                      const bh = (box.height / 100) * webcamSnapshot.height;
                      return (
                        <g key={box.id || idx}>
                          <rect
                            x={bx}
                            y={by}
                            width={bw}
                            height={bh}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={Math.max(2, webcamSnapshot.width / 320)}
                          />
                          <rect
                            x={bx}
                            y={Math.max(0, by - 20)}
                            width={Math.max(50, bw * 0.45)}
                            height={18}
                            fill="#ef4444"
                            rx={2}
                          />
                          <text
                            x={bx + 4}
                            y={Math.max(12, by - 6)}
                            fill="#ffffff"
                            fontSize={11}
                            fontWeight="600"
                            fontFamily="sans-serif"
                          >
                            {box.confidence ? `defect ${Math.round(box.confidence)}%` : "defect"}
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>
            ) : cameraStatus === "live" ? (
              // Live Video Feed (Plain, no overlays)
              <div
                className="w-full relative bg-black rounded-xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center"
                style={{ aspectRatio: "16 / 9", maxHeight: "560px" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              </div>
            ) : cameraStatus === "starting" ? (
              <div
                className="w-full rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2.5 text-slate-500"
                style={{ aspectRatio: "16 / 9", maxHeight: "560px" }}
              >
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Starting camera…</span>
              </div>
            ) : cameraStatus === "error" ? (
              <div
                className="w-full rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center p-6 text-center"
                style={{ aspectRatio: "16 / 9", maxHeight: "560px" }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-rose-200 shadow-xs flex items-center justify-center mb-3 text-rose-600">
                  <VideoOff className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-rose-900 mb-1">Camera Unavailable</h4>
                <p className="text-xs text-rose-700 max-w-sm mb-4">{cameraError}</p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Use Upload
                  </button>
                </div>
              </div>
            ) : (
              // Camera Idle View
              <div
                className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center p-6 text-center"
                style={{ aspectRatio: "16 / 9", maxHeight: "560px" }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-3 text-slate-600">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Local Browser Webcam</h4>
                <p className="text-xs text-slate-500 mb-4 max-w-sm">
                  Connect your laptop camera or USB webcam to capture and analyze casting parts directly.
                </p>
                <button
                  type="button"
                  onClick={handleStartCamera}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Start Camera
                </button>
              </div>
            )}

            {/* Webcam Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                {cameraStatus === "live" && !webcamSnapshot && (
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                  >
                    Stop Camera
                  </button>
                )}

                {webcamSnapshot && (
                  <button
                    type="button"
                    onClick={handleTakeAnotherPicture}
                    disabled={isAnalyzing}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                  >
                    Take Another Picture
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {cameraStatus === "live" && !webcamSnapshot && (
                  <div className="flex items-center gap-3">
                    {unmetReason && (
                      <span className="text-xs text-amber-700 font-medium truncate max-w-xs">
                        {unmetReason}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleTakePicture}
                      disabled={!isVideoReady || !isReadyToAnalyze || isAnalyzing}
                      className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                        isVideoReady && isReadyToAnalyze && !isAnalyzing
                          ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                          : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Picture</span>
                    </button>
                  </div>
                )}

                {isAnalyzing && (
                  <span className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing picture…</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Analysis Error & Retry Action */}
        {analysisError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Analysis failed</p>
                <p className="text-rose-700 mt-0.5">{analysisError}</p>
              </div>
            </div>
            {requestIdentityRef.current && (
              <button
                type="button"
                onClick={() =>
                  requestIdentityRef.current &&
                  executeAnalysis(
                    requestIdentityRef.current.captureSource,
                    requestIdentityRef.current.jpegBase64
                  )
                }
                disabled={isAnalyzing}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0"
              >
                Retry Analysis
              </button>
            )}
          </div>
        )}

        {/* Inspection Result Explanations */}
        {lastResult && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Classification:</span>
              <span
                className={`font-bold capitalize ${
                  lastResult.outcome === "ok"
                    ? "text-emerald-700"
                    : lastResult.outcome === "defect"
                    ? "text-rose-700"
                    : "text-amber-700"
                }`}
              >
                {lastResult.outcome === "unknown" ? "Needs review" : lastResult.outcome}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                Confidence: {lastResult.confidence !== null ? `${lastResult.confidence}%` : "—"}
              </span>
            </div>

            <div>
              {lastResult.outcome === "defect" &&
                lastResult.localizationStatus === "completed" &&
                lastResult.boundingBoxes.length === 0 && (
                  <span className="text-amber-700 font-medium">
                    Defect detected; location not identified
                  </span>
                )}
              {lastResult.outcome === "defect" &&
                lastResult.localizationStatus === "failed" && (
                  <span className="text-amber-700 font-medium">
                    Defect detected; localization unavailable
                  </span>
                )}
              {lastResult.outcome === "unknown" &&
                lastResult.localizationStatus === "failed" && (
                  <span className="text-amber-700 font-medium">
                    Localization unavailable
                  </span>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

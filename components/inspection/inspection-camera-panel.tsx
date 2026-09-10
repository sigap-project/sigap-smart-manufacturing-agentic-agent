"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Camera,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Video,
  VideoOff,
  Zap,
  Sliders,
  FileImage,
  Layers,
  Send,
} from "lucide-react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

interface InspectionCameraPanelProps {
  lotId?: string;
  productType?: string;
  onAnalysisComplete?: (data: any) => void;
}

export function InspectionCameraPanel({
  lotId = "#B-2026-0730",
  productType = "Bracket Motor A7",
  onAnalysisComplete,
}: InspectionCameraPanelProps) {
  // Mode: "upload" (File Upload & Quick Presets) | "camera" (Live Device Webcam)
  const [activeMode, setActiveMode] = useState<"upload" | "camera">("upload");

  // State File Upload
  const [selectedImage, setSelectedImage] = useState<string>("/sample-frames/defect.jpeg");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTestPreset, setSelectedTestPreset] = useState<"defect" | "ok">("defect");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Webcam
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isContinuousScan, setIsContinuousScan] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State Analisis AI
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [isCapturingFlash, setIsCapturingFlash] = useState(false);

  // Hasil Analisis Terakhir dari Backend
  const [lastResult, setLastResult] = useState<{
    status: "idle" | "defect" | "ok";
    defectClass: string;
    confidence: number;
    severity: string;
    escalationScore: number;
    recommendation: string;
    boundingBoxes: BoundingBox[];
    sapTickets: string[];
    timestamp: string;
  }>({
    status: "defect",
    defectClass: "defect",
    confidence: 96.4,
    severity: "High",
    escalationScore: 0.74,
    recommendation: "quarantine",
    boundingBoxes: [
      {
        x: 12,
        y: 10,
        width: 26,
        height: 28,
        label: "defect",
        confidence: 96.4,
      },
    ],
    sapTickets: ["QM-2026-9912", "MM-HOLD-0814"],
    timestamp: "Siap Uji",
  });

  // ===========================================================================
  // 1. WEBCAM CONTROLLER
  // ===========================================================================
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Gagal mengakses kamera:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Izin akses kamera ditolak. Silakan izinkan kamera di browser."
          : "Kamera perangkat tidak ditemukan atau sedang digunakan aplikasi lain."
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsContinuousScan(false);
  };

  // Bersihkan stream saat unmount atau ganti tab
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Ambil frame snapshot dari video canvas
  const grabFrameFromVideo = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  // ===========================================================================
  // 2. EKSEKUSI PIPELINE ANALISIS AI BACKEND
  // ===========================================================================
  const runAiAnalysis = async (customImageBase64?: string, presetType?: "defect" | "ok") => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setIsCapturingFlash(true);
    setTimeout(() => setIsCapturingFlash(false), 250);

    try {
      const payload: any = {
        lotId,
        productType,
      };

      if (customImageBase64) {
        payload.imageBase64 = customImageBase64;
      } else if (presetType) {
        payload.testType = presetType;
      } else if (activeMode === "upload") {
        payload.testType = selectedTestPreset;
        payload.imageBase64 = selectedImage.startsWith("data:") ? selectedImage : undefined;
      } else if (activeMode === "camera") {
        const frameData = grabFrameFromVideo();
        if (frameData) {
          payload.imageBase64 = frameData;
          setSelectedImage(frameData);
        }
      }

      const res = await fetch("/api/inspection/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        const isDef = data.inspection?.defectDetected;
        const boxes = Array.isArray(data.boundingBoxes) ? data.boundingBoxes : [];
        const sapTicketList = (data.sapDispatches || []).map((d: any) => `${d.consumer}: ${d.ticketId}`);

        setLastResult({
          status: isDef ? "defect" : "ok",
          defectClass: data.inspection?.defectClass || (isDef ? "defect" : "ok"),
          confidence: data.inspection?.confidence || 95.0,
          severity: data.inspection?.severity || (isDef ? "High" : "None"),
          escalationScore: data.escalationScore ?? 0.74,
          recommendation: data.recommendation || (isDef ? "quarantine" : "release"),
          boundingBoxes: boxes,
          sapTickets: sapTicketList,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });

        // Trigger parent callback jika disediakan
        if (onAnalysisComplete) {
          onAnalysisComplete(data);
        }
      }
    } catch (err) {
      console.error("Gagal menjalankan analisis backend:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Continuous scan interval untuk webcam
  useEffect(() => {
    if (isContinuousScan && isCameraActive) {
      scanIntervalRef.current = setInterval(() => {
        runAiAnalysis();
      }, 4000);
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isContinuousScan, isCameraActive]);

  // ===========================================================================
  // 3. HANDLER FILE UPLOAD & PRESET
  // ===========================================================================
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Hanya file citra (.jpg, .png, .webp) yang didukung.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSelectedImage(dataUrl);
      // Jalankan analisis seketika saat gambar baru dipilih
      runAiAnalysis(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (type: "defect" | "ok") => {
    setSelectedTestPreset(type);
    const presetPath = type === "defect" ? "/sample-frames/defect.jpeg" : "/sample-frames/ok.jpeg";
    setSelectedImage(presetPath);
    runAiAnalysis(undefined, type);
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-[#07090e] border border-white/[0.08] shadow-2xl flex flex-col min-h-[560px] sm:min-h-[620px] select-none group">
      {/* Hidden Canvas untuk Capture Frame */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header Mode Switcher Bar */}
      <div className="relative z-30 p-3 sm:p-4 bg-[#0a0d14]/90 backdrop-blur-xl border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5">
        {/* Tab Buttons */}
        <div className="flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
          <button
            onClick={() => {
              stopCamera();
              setActiveMode("upload");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer ${
              activeMode === "upload"
                ? "bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Gambar</span>
          </button>

          <button
            onClick={() => {
              setActiveMode("camera");
              startCamera();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer ${
              activeMode === "camera"
                ? "bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera Langsung</span>
          </button>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {activeMode === "camera" && isCameraActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE CAM</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400">
            <span className="text-zinc-500">Lot:</span>
            <span className="text-emerald-400 font-bold">{lotId}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full overflow-hidden bg-[#06080d] flex items-center justify-center">
        {/* Sensor Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

        {/* Ambient Vignette Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,#050608_95%)] pointer-events-none" />

        {/* ------------------------------------------------------------------- */}
        {/* MODE 1: FILE UPLOAD & PREVIEW */}
        {/* ------------------------------------------------------------------- */}
        {activeMode === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`relative w-full h-full flex items-center justify-center p-4 transition-all ${
              isDragOver ? "ring-2 ring-emerald-500 bg-emerald-500/5" : ""
            }`}
          >
            {/* Hidden Input File */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {/* Display Selected Image */}
            <div className="relative max-w-full max-h-[440px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage}
                alt="Frame Inspeksi Pengecoran"
                className="max-h-[420px] w-auto object-contain select-none"
              />

              {/* Dynamic Bounding Box Overlay (Rendered directly over image) */}
              {showBoundingBoxes &&
                lastResult.boundingBoxes.map((box, idx) => {
                  const isDef = lastResult.status === "defect";
                  return (
                    <div
                      key={idx}
                      className={`absolute rounded-lg flex flex-col justify-between p-1.5 transition-all duration-300 ${
                        isDef
                          ? "border-2 border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.35)] animate-pulse"
                          : "border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                      }`}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-mono text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-md ${
                            isDef
                              ? "bg-amber-500 text-zinc-950"
                              : "bg-emerald-500 text-zinc-950"
                          }`}
                        >
                          {isDef ? (
                            <AlertTriangle className="w-2.5 h-2.5" />
                          ) : (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          )}
                          {box.label} [{box.confidence}%]
                        </span>
                      </div>
                      <div
                        className={`flex items-center justify-between text-[8px] font-mono ${
                          isDef ? "text-amber-300" : "text-emerald-300"
                        }`}
                      >
                        <span>X: {Math.round(box.x * 6.4)}</span>
                        <span>Y: {Math.round(box.y * 4.8)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODE 2: LIVE DEVICE WEBCAM */}
        {/* ------------------------------------------------------------------- */}
        {activeMode === "camera" && (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {isCameraActive ? (
              <div className="relative max-w-full max-h-[440px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="max-h-[420px] w-auto object-contain"
                />

                {/* Live Camera Bounding Box Overlay */}
                {showBoundingBoxes &&
                  lastResult.boundingBoxes.map((box, idx) => {
                    const isDef = lastResult.status === "defect";
                    return (
                      <div
                        key={idx}
                        className={`absolute rounded-lg flex flex-col justify-between p-1.5 transition-all duration-300 pointer-events-none ${
                          isDef
                            ? "border-2 border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                            : "border-2 border-emerald-400 bg-emerald-500/10"
                        }`}
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          height: `${box.height}%`,
                        }}
                      >
                        <span
                          className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded self-start flex items-center gap-1 shadow-md ${
                            isDef ? "bg-amber-500 text-zinc-950" : "bg-emerald-500 text-zinc-950"
                          }`}
                        >
                          {box.label} [{box.confidence}%]
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-3">
                  <Camera className="w-8 h-8 text-zinc-400" />
                </div>
                <h4 className="font-display text-base font-bold text-white mb-1">
                  Kamera Belum Aktif
                </h4>
                <p className="font-sans text-xs text-zinc-400 mb-4">
                  {cameraError || "Aktifkan kamera perangkat untuk memindai komponen casting secara langsung."}
                </p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Nyalakan Kamera</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Optical HUD Framing Corners */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400/60 pointer-events-none" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400/60 pointer-events-none" />
        <div className="absolute bottom-20 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400/60 pointer-events-none" />
        <div className="absolute bottom-20 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400/60 pointer-events-none" />

        {/* Futuristic Scanline Animation saat Analisis Berlangsung */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.9)] animate-pulse top-1/2 -translate-y-1/2 absolute" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-2 shadow-xl backdrop-blur-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>YOLOv8 &amp; AWS Bedrock Menganalisis Citra...</span>
            </div>
          </div>
        )}

        {/* Shutter White Flash Effect */}
        {isCapturingFlash && (
          <div className="absolute inset-0 bg-white/40 z-40 pointer-events-none transition-opacity duration-200" />
        )}
      </div>

      {/* Quick Test Presets Bar (Hanya di mode Upload) */}
      {activeMode === "upload" && (
        <div className="relative z-20 px-4 py-2.5 bg-[#0a0d14]/70 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-zinc-400">Sampel Uji Cepat:</span>
            <button
              onClick={() => handleSelectPreset("defect")}
              className={`px-3 py-1 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedTestPreset === "defect"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20"
                  : "bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:text-white"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Uji Cacat (Defect)</span>
            </button>

            <button
              onClick={() => handleSelectPreset("ok")}
              className={`px-3 py-1 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedTestPreset === "ok"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                  : "bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Uji Bersih (OK)</span>
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileImage className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pilih File Komputer</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Glassmorphic Control Bar */}
      <div className="relative z-30 p-3 sm:p-4 bg-[#07090e]/95 backdrop-blur-2xl border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          {activeMode === "upload" ? (
            <button
              onClick={() => runAiAnalysis()}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isAnalyzing ? "Menganalisis..." : "Analisis Frame AI"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => runAiAnalysis()}
                disabled={!isCameraActive || isAnalyzing}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Ambil Frame &amp; Analisis</span>
              </button>

              <button
                onClick={() => setIsContinuousScan((prev) => !prev)}
                disabled={!isCameraActive}
                className={`px-3 py-2 rounded-xl font-mono text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  isContinuousScan
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold animate-pulse"
                    : "bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:text-white"
                }`}
                title="Scan otomatis setiap 4 detik"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Auto Scan (4s)</span>
              </button>
            </div>
          )}

          {/* Toggle Bounding Box Button */}
          <button
            onClick={() => setShowBoundingBoxes((prev) => !prev)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              showBoundingBoxes
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-white/5 text-zinc-400 border-white/10"
            }`}
            title="Tampilkan / Sembunyikan Bounding Box AI"
          >
            {showBoundingBoxes ? (
              <Eye className="w-4 h-4 text-emerald-400" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Right Status Result Badge */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              lastResult.status === "defect"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            }`}
          >
            {lastResult.status === "defect" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="font-bold">{lastResult.defectClass}</span>
            <span className="text-zinc-500">|</span>
            <span>{lastResult.confidence}%</span>
          </div>

          {lastResult.sapTickets.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px]">
              <Send className="w-3 h-3" />
              <span>SAP ERP Terkirim</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

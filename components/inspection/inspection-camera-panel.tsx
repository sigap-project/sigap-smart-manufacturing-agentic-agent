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
  FileImage,
  Send,
  RotateCcw,
  Play,
  Layers,
  Info,
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
  // Mode: "upload" (File Upload) | "camera" (Webcam & Optical Feed)
  const [activeMode, setActiveMode] = useState<"upload" | "camera">("upload");

  // State File Upload
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Kamera & Feed Live
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isContinuousScan, setIsContinuousScan] = useState(false);
  const [cameraViewMode, setCameraViewMode] = useState<"live" | "snapshot">("live");
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  // Refs untuk Media Stream & Canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // State Analisis AI
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [cameraHasAnalyzed, setCameraHasAnalyzed] = useState(false);
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
    status: "idle",
    defectClass: "Menunggu Citra",
    confidence: 0,
    severity: "None",
    escalationScore: 0,
    recommendation: "none",
    boundingBoxes: [],
    sapTickets: [],
    timestamp: "-",
  });

  // ===========================================================================
  // 1. SOUND & SHUTTER FEEDBACK
  // ===========================================================================
  const playShutterSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // AudioContext mungkin dibatasi sebelum gesture pengguna pertama
    }
  }, []);

  // ===========================================================================
  // 2. WEBCAM CONTROLLER
  // ===========================================================================
  const startCamera = async () => {
    try {
      setCameraError(null);
      setIsSimulated(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setCameraViewMode("live");

      // Pasang stream langsung ke elemen video jika sudah ter-mount di DOM
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn("Video autoPlay caught:", err);
        });
      }
    } catch (err: any) {
      console.error("Gagal mengakses kamera:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Izin akses kamera ditolak oleh browser. Silakan klik ikon gembok di address bar untuk mengizinkan akses kamera, atau gunakan opsi 'Simulasi Feed Konveyor'."
          : "Kamera perangkat tidak ditemukan atau sedang digunakan aplikasi lain. Anda dapat mencoba 'Simulasi Feed Konveyor'."
      );
      setIsCameraActive(false);
    }
  };

  const startSimulatedFeed = () => {
    stopCameraStreams();
    setCameraError(null);
    setIsSimulated(true);
    setIsCameraActive(true);
    setCameraViewMode("live");
  };

  const stopCameraStreams = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
  };

  const stopCamera = () => {
    stopCameraStreams();
    setIsCameraActive(false);
    setIsSimulated(false);
    setIsContinuousScan(false);
  };

  // Pastikan stream terhubung ke elemen <video> setiap kali video ter-mount
  useEffect(() => {
    if (
      activeMode === "camera" &&
      isCameraActive &&
      !isSimulated &&
      mediaStreamRef.current &&
      videoRef.current
    ) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [activeMode, isCameraActive, isSimulated, cameraViewMode]);

  // Bersihkan stream saat unmount
  useEffect(() => {
    return () => {
      stopCameraStreams();
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // ===========================================================================
  // 3. ANIMASI FEED SIMULASI KONVEYOR (FALLBACK TANPA WEBCAM)
  // ===========================================================================
  useEffect(() => {
    if (!isSimulated || activeMode !== "camera" || !isCameraActive) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    const canvas = simCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let posX = 200;
    let speed = 2.2;
    let laserY = 100;
    let laserDir = 1;

    const renderConveyorLoop = () => {
      canvas.width = 1280;
      canvas.height = 720;

      // 1. Conveyor Background Grid
      ctx.fillStyle = "#090d15";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Belt track lines
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      for (let y = 140; y <= 580; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Moving Conveyor Rollers
      posX = (posX + speed) % (canvas.width + 300);
      const drawX = posX - 150;

      // 2. Cast Bracket Workpiece (Benda Kerja Cetakan)
      ctx.save();
      ctx.translate(drawX, 360);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 85, 140, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bracket Body
      const metalGrad = ctx.createLinearGradient(-110, -70, 110, 70);
      metalGrad.addColorStop(0, "#475569");
      metalGrad.addColorStop(0.5, "#64748b");
      metalGrad.addColorStop(1, "#334155");
      ctx.fillStyle = metalGrad;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.roundRect(-120, -65, 240, 130, [20]);
      ctx.fill();
      ctx.stroke();

      // Mounting holes
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.arc(-75, 0, 20, 0, Math.PI * 2);
      ctx.arc(75, 0, 20, 0, Math.PI * 2);
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Industrial Stamped Code
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`SIGAP-${lotId.replace("#", "")} [A7]`, -70, 48);

      // Simulated casting defects (Porosity & Micro Crack)
      ctx.fillStyle = "#18181b";
      ctx.beginPath();
      ctx.arc(32, -26, 4.5, 0, Math.PI * 2);
      ctx.arc(39, -29, 3, 0, Math.PI * 2);
      ctx.arc(36, -21, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 3. Sweeping Optical Laser Scanner Beam
      laserY += laserDir * 4;
      if (laserY > 600) laserDir = -1;
      if (laserY < 120) laserDir = 1;

      const beamGrad = ctx.createLinearGradient(0, laserY - 20, 0, laserY + 20);
      beamGrad.addColorStop(0, "rgba(6,182,212,0)");
      beamGrad.addColorStop(0.5, "rgba(6,182,212,0.65)");
      beamGrad.addColorStop(1, "rgba(6,182,212,0)");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, laserY - 20, canvas.width, 40);

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, laserY);
      ctx.lineTo(canvas.width, laserY);
      ctx.stroke();

      animFrameIdRef.current = requestAnimationFrame(renderConveyorLoop);
    };

    renderConveyorLoop();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isSimulated, activeMode, isCameraActive, lotId]);

  // ===========================================================================
  // 4. PENGAMBILAN FRAME CITRA (CAPTURE MECHANISM)
  // ===========================================================================
  const grabFrameFromVideo = (): string | null => {
    // A. Jika mode simulasi konveyor
    if (isSimulated && simCanvasRef.current) {
      return simCanvasRef.current.toDataURL("image/jpeg", 0.9);
    }

    // B. Jika webcam fisik
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || video.clientWidth || 1280;
    const height = video.videoHeight || video.clientHeight || 720;
    if (width === 0 || height === 0) return null;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  // Handler utama klik "Ambil Frame Sekarang"
  const handleCaptureFrame = async () => {
    if (isAnalyzing) return;

    // 1. Shutter sound & visual flash
    playShutterSound();
    setIsCapturingFlash(true);
    setTimeout(() => setIsCapturingFlash(false), 220);

    // 2. Ambil snapshot frame dari video
    const frameData = grabFrameFromVideo();
    const timeNow = new Date().toLocaleTimeString("id-ID");

    if (frameData) {
      setCapturedSnapshot(frameData);
      setSnapshotTimestamp(timeNow);
      setCameraViewMode("snapshot"); // Freeze dan perlihatkan frame yang ditangkap
      // 3. Jalankan analisis AI pada frame ini
      await runAiAnalysis(frameData);
    } else {
      // Fallback
      setSnapshotTimestamp(timeNow);
      await runAiAnalysis();
    }
  };

  // ===========================================================================
  // 5. EKSEKUSI PIPELINE ANALISIS AI BACKEND
  // ===========================================================================
  const runAiAnalysis = async (customImageBase64?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    try {
      const payload: any = {
        lotId,
        productType,
      };

      if (customImageBase64) {
        payload.imageBase64 = customImageBase64;
      } else if (activeMode === "upload") {
        if (!selectedImage) return;
        payload.imageBase64 = selectedImage.startsWith("data:") ? selectedImage : undefined;
      } else if (activeMode === "camera") {
        if (capturedSnapshot) {
          payload.imageBase64 = capturedSnapshot;
        } else {
          const frameData = grabFrameFromVideo();
          if (frameData) {
            payload.imageBase64 = frameData;
            setCapturedSnapshot(frameData);
          } else {
            payload.testType = "defect";
          }
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
        const sapTicketList = (data.sapDispatches || []).map(
          (d: any) => `${d.consumer}: ${d.ticketId}`
        );

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

        if (activeMode === "camera") {
          setCameraHasAnalyzed(true);
        }

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

  // Continuous auto-scan interval untuk webcam
  useEffect(() => {
    if (isContinuousScan && isCameraActive && cameraViewMode === "live") {
      scanIntervalRef.current = setInterval(() => {
        handleCaptureFrame();
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
  }, [isContinuousScan, isCameraActive, cameraViewMode]);

  // ===========================================================================
  // 6. HANDLER FILE UPLOAD
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
      runAiAnalysis(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-[#07090e] border border-white/[0.08] shadow-2xl flex flex-col min-h-[580px] select-none group">
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
              setCameraHasAnalyzed(false);
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
              <span>{isSimulated ? "SIMULATED FEED" : "LIVE WEBCAM"}</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400">
            <span className="text-zinc-500">Lot:</span>
            <span className="text-emerald-400 font-bold">{lotId}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full overflow-hidden bg-[#06080d] flex items-center justify-center min-h-[440px]">
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

            {!selectedImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-md p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer select-none group ${
                  isDragOver
                    ? "border-emerald-400 bg-emerald-500/10 ring-4 ring-emerald-500/20"
                    : "border-white/15 bg-white/[0.02] hover:border-emerald-400/50 hover:bg-white/[0.04]"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Upload className="w-7 h-7 text-emerald-400" />
                </div>
                <h4 className="font-display text-base font-bold text-white mb-1.5">
                  Unggah Citra Komponen
                </h4>
                <p className="font-sans text-xs text-zinc-400 max-w-xs mb-5 leading-relaxed">
                  Pilih file gambar (.jpg, .png, .webp) atau seret ke area ini untuk memulai inspeksi optik AI.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Pilih File Komputer</span>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative max-w-full max-h-[440px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 hover:border-emerald-500/40 flex items-center justify-center bg-black/40 cursor-pointer transition-colors"
                title="Klik untuk memilih file citra lain dari komputer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage}
                  alt="Frame Inspeksi Pengecoran"
                  className="max-h-[420px] w-auto object-contain select-none"
                />

                {/* Bounding Box Overlay */}
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
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODE 2: LIVE DEVICE WEBCAM & OPTICAL FRAME CAPTURE */}
        {/* ------------------------------------------------------------------- */}
        {activeMode === "camera" && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-2 sm:p-4">
            {isCameraActive ? (
              <div className="relative w-full max-w-2xl max-h-[460px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black flex items-center justify-center">
                {/* SUB-MODE A: TAMPILAN LIVE STREAMING (WEBCAM / SIMULASI) */}
                {cameraViewMode === "live" && (
                  <>
                    {/* Live Stream Video Node (Physical Webcam) */}
                    {!isSimulated && (
                      <video
                        ref={(node) => {
                          videoRef.current = node;
                          if (
                            node &&
                            mediaStreamRef.current &&
                            node.srcObject !== mediaStreamRef.current
                          ) {
                            node.srcObject = mediaStreamRef.current;
                            node.play().catch(() => {});
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={(e) => {
                          e.currentTarget.play().catch(() => {});
                        }}
                        className="w-full max-h-[420px] object-contain bg-black"
                      />
                    )}

                    {/* Canvas Simulasi Konveyor (Jika Memilih Simulasi / Webcam Tidak Tersedia) */}
                    {isSimulated && (
                      <canvas
                        ref={simCanvasRef}
                        className="w-full max-h-[420px] object-contain bg-black"
                      />
                    )}

                    {/* Optical Alignment HUD Reticle di Tengah Viewport */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                      <div className="relative w-64 sm:w-80 h-44 sm:h-52 border border-emerald-500/30 rounded-2xl flex flex-col items-center justify-between p-2.5 shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-emerald-500/[0.02]">
                        {/* 4 Corner Bracket Accents */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-emerald-400" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-emerald-400" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-emerald-400" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-emerald-400" />

                        {/* Top Target Label */}
                        <div className="px-2.5 py-0.5 rounded-full bg-black/60 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 tracking-wider">
                          TARGET DETEKSI OPTIK
                        </div>

                        {/* Center Crosshair */}
                        <div className="relative w-6 h-6 flex items-center justify-center text-emerald-400/80">
                          <div className="w-full h-0.5 bg-emerald-400/80" />
                          <div className="h-full w-0.5 bg-emerald-400/80 absolute" />
                        </div>

                        {/* Bottom Instruction Hint */}
                        <div className="text-[10px] font-mono text-zinc-300 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
                          Posisikan benda di dalam kotak target
                        </div>
                      </div>
                    </div>

                    {/* Top HUD Telemetry Info Bar Overlay */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-white font-mono text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-bold text-emerald-300">
                          {isSimulated ? "SIMULASI FEED 30FPS" : "LIVE FEED 720p"}
                        </span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-zinc-400">CAM #01</span>
                      </div>

                      {capturedSnapshot && (
                        <button
                          type="button"
                          onClick={() => setCameraViewMode("snapshot")}
                          className="pointer-events-auto px-3 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/15 font-mono text-[11px] flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-emerald-400" />
                          <span>Lihat Snapshot Terakhir</span>
                        </button>
                      )}
                    </div>

                    {/* Floating Shutter Capture Button di Bawah Viewfinder */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-20">
                      <button
                        type="button"
                        onClick={handleCaptureFrame}
                        disabled={isAnalyzing}
                        className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-bold font-mono text-xs sm:text-sm flex items-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.55)] border-2 border-emerald-300 transition-all cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                        ) : (
                          <Camera className="w-4 h-4 text-zinc-950" />
                        )}
                        <span>{isAnalyzing ? "Menganalisis Frame..." : "AMBIL FRAME SEKARANG"}</span>
                      </button>
                      <span className="text-[10px] font-mono text-zinc-400 bg-black/70 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                        Klik untuk capture &amp; deteksi cacat AI
                      </span>
                    </div>
                  </>
                )}

                {/* SUB-MODE B: TAMPILAN SNAPSHOT FRAME TERANALISIS */}
                {cameraViewMode === "snapshot" && capturedSnapshot && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedSnapshot}
                      alt="Captured Frame Snapshot"
                      className="w-full max-h-[420px] object-contain select-none"
                    />

                    {/* Top Snapshot Info Bar */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-mono text-[11px] shadow-lg">
                        <Camera className="w-3 h-3 text-cyan-400" />
                        <span className="font-bold">SNAPSHOT TERANALISIS</span>
                        {snapshotTimestamp && (
                          <>
                            <span className="text-zinc-500">|</span>
                            <span className="text-zinc-300">{snapshotTimestamp}</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCameraViewMode("live")}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Kembali ke Live Feed</span>
                      </button>
                    </div>

                    {/* Bounding Box Overlay pada Snapshot Beku */}
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

                    {/* Floating Re-Capture / Return Action Bar */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                      <button
                        type="button"
                        onClick={() => setCameraViewMode("live")}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Ambil Frame Baru (Live)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => runAiAnalysis(capturedSnapshot)}
                        disabled={isAnalyzing}
                        className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/20 font-mono text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-cyan-400 ${
                            isAnalyzing ? "animate-spin" : ""
                          }`}
                        />
                        <span>Analisis Ulang</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* State Kamera Belum Aktif / Error */
              <div className="flex flex-col items-center justify-center p-6 text-center max-w-md bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-sm">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3.5 text-emerald-400">
                  <Video className="w-8 h-8" />
                </div>
                <h4 className="font-display text-base font-bold text-white mb-1.5">
                  Stasiun Kamera Belum Aktif
                </h4>
                <p className="font-sans text-xs text-zinc-400 mb-4 max-w-sm leading-relaxed">
                  Aktifkan kamera webcam perangkat Anda untuk memindai komponen pengecoran secara langsung, atau gunakan simulasi feed konveyor optik.
                </p>

                {cameraError && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px] text-left flex items-start gap-2 max-w-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
                  <button
                    onClick={startCamera}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Nyalakan Kamera Web</span>
                  </button>

                  <button
                    onClick={startSimulatedFeed}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/15 font-mono text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    title="Gunakan feed simulasi konveyor jika kamera fisik tidak tersedia"
                  >
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span>Simulasi Feed Konveyor</span>
                  </button>
                </div>
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
          <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.9)] animate-pulse top-1/2 -translate-y-1/2 absolute" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>YOLOv8 &amp; AWS Bedrock Menganalisis Citra...</span>
            </div>
          </div>
        )}

        {/* Shutter White Flash Effect */}
        {isCapturingFlash && (
          <div className="absolute inset-0 bg-white/70 z-50 pointer-events-none transition-opacity duration-200" />
        )}
      </div>

      {/* Bottom Floating Glassmorphic Control Bar */}
      <div className="relative z-30 p-3 sm:p-4 bg-[#07090e]/95 backdrop-blur-2xl border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          {activeMode === "upload" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => runAiAnalysis()}
                disabled={!selectedImage || isAnalyzing}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isAnalyzing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isAnalyzing ? "Menganalisis..." : "Analisis Frame AI"}</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 font-mono text-xs flex items-center gap-2 transition-colors cursor-pointer"
                title="Pilih file citra dari komputer"
              >
                <FileImage className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedImage ? "Ganti File Citra" : "Pilih File Komputer"}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {cameraViewMode === "live" ? (
                <>
                  <button
                    onClick={handleCaptureFrame}
                    disabled={!isCameraActive || isAnalyzing}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ambil Frame &amp; Deteksi</span>
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

                  {isCameraActive && (
                    <button
                      onClick={stopCamera}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Matikan stream kamera"
                    >
                      <VideoOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Matikan Kamera</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setCameraViewMode("live")}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Kembali ke Live Feed</span>
                  </button>

                  <button
                    onClick={() => runAiAnalysis(capturedSnapshot || undefined)}
                    disabled={isAnalyzing}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10 font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-cyan-400 ${
                        isAnalyzing ? "animate-spin" : ""
                      }`}
                    />
                    <span>Analisis Ulang</span>
                  </button>
                </>
              )}
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
          {lastResult.status !== "idle" ? (
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
          ) : (
            <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span>Menunggu Frame</span>
            </div>
          )}

          {lastResult.status !== "idle" && lastResult.sapTickets.length > 0 && (
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

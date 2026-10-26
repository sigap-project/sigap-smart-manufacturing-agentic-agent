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
    defectClass: "Awaiting Workpiece",
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
      // AudioContext may be restricted before user gesture
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

      // Attach stream to video node if mounted
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn("Video autoPlay caught:", err);
        });
      }
    } catch (err: any) {
      console.error("Failed to access camera device:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied by your browser. Please allow camera access or use the 'Simulate Conveyor Feed' option."
          : "No camera hardware detected or device is in use by another app. You may run the 'Simulate Conveyor Feed'."
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
      alert("Only image files (.jpg, .png, .webp) are supported.");
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
    <div className="relative w-full rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col min-h-[580px] select-none group hover:-translate-y-1 hover:shadow-md transition-all duration-200">
      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header Mode Switcher Bar */}
      <div className="relative z-30 p-3 sm:p-4 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
        {/* Tab Buttons */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
          <button
            onClick={() => {
              stopCamera();
              setActiveMode("upload");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeMode === "upload"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>

          <button
            onClick={() => {
              setActiveMode("camera");
              setCameraHasAnalyzed(false);
              startCamera();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeMode === "camera"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2 text-xs">
          {activeMode === "camera" && isCameraActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>{isSimulated ? "Simulated Feed" : "Live Camera"}</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-medium">
            <span className="text-slate-400">Lot:</span>
            <span className="text-slate-900 font-semibold">{lotId}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full overflow-hidden bg-[#0A0D14] flex items-center justify-center min-h-[440px]">
        {/* Sensor Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

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
              isDragOver ? "ring-2 ring-blue-500 bg-blue-500/5" : ""
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
                className={`w-full max-w-md p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer select-none group ${
                  isDragOver
                    ? "border-blue-400 bg-blue-500/10 ring-4 ring-blue-500/20"
                    : "border-slate-700/60 bg-white/[0.02] hover:border-blue-400 hover:bg-white/[0.04]"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform text-blue-400">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="font-sans text-base font-bold text-white mb-1.5">
                  Upload Component Image
                </h4>
                <p className="font-sans text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
                  Select an image file (.jpg, .png, .webp) or drag &amp; drop here to initiate AI optical inspection.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Browse Local Files</span>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative max-w-full max-h-[440px] rounded-xl overflow-hidden shadow-2xl border border-white/10 hover:border-blue-400/50 flex items-center justify-center bg-black/40 cursor-pointer transition-colors"
                title="Click to select another image file"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage}
                  alt="Casting Inspection Frame"
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
                            ? "border-2 border-rose-500 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.35)]"
                            : "border-2 border-emerald-400 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
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
                                ? "bg-rose-500 text-white"
                                : "bg-emerald-500 text-white"
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
                            isDef ? "text-rose-300" : "text-emerald-300"
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
              <div className="relative w-full max-w-2xl max-h-[460px] rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black flex items-center justify-center">
                {/* SUB-MODE A: LIVE STREAMING (WEBCAM / SIMULATION) */}
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

                    {/* Simulation Conveyor Canvas */}
                    {isSimulated && (
                      <canvas
                        ref={simCanvasRef}
                        className="w-full max-h-[420px] object-contain bg-black"
                      />
                    )}

                    {/* Optical Alignment Reticle in Center */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                      <div className="relative w-64 sm:w-80 h-44 sm:h-52 border border-blue-400/40 rounded-xl flex flex-col items-center justify-between p-2.5 shadow-[0_0_25px_rgba(59,130,246,0.15)] bg-blue-500/[0.02]">
                        {/* 4 Corner Bracket Accents */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-blue-400" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-blue-400" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-blue-400" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-blue-400" />

                        {/* Top Target Label */}
                        <div className="px-2.5 py-0.5 rounded-full bg-black/70 border border-blue-400/40 text-[10px] font-mono text-blue-300 tracking-wider">
                          OPTICAL DETECTION TARGET
                        </div>

                        {/* Center Crosshair */}
                        <div className="relative w-6 h-6 flex items-center justify-center text-blue-400/80">
                          <div className="w-full h-0.5 bg-blue-400/80" />
                          <div className="h-full w-0.5 bg-blue-400/80 absolute" />
                        </div>

                        {/* Bottom Instruction Hint */}
                        <div className="text-[10px] font-mono text-slate-300 bg-black/70 px-2.5 py-0.5 rounded-md border border-white/10">
                          Align workpiece within target reticle
                        </div>
                      </div>
                    </div>

                    {/* Top HUD Telemetry Info Bar Overlay */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-white text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold text-emerald-300">
                          {isSimulated ? "30 FPS SIMULATED FEED" : "720p OPTICAL FEED"}
                        </span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-zinc-400">CAM #01</span>
                      </div>

                      {capturedSnapshot && (
                        <button
                          type="button"
                          onClick={() => setCameraViewMode("snapshot")}
                          className="pointer-events-auto px-3 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/15 text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-blue-400" />
                          <span>View Last Snapshot</span>
                        </button>
                      )}
                    </div>

                    {/* Floating Shutter Capture Button */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-20">
                      <button
                        type="button"
                        onClick={handleCaptureFrame}
                        disabled={isAnalyzing}
                        className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-98 text-slate-900 font-semibold text-xs flex items-center gap-2.5 shadow-lg border border-slate-200 transition-all cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                        ) : (
                          <Camera className="w-4 h-4 text-slate-900" />
                        )}
                        <span>{isAnalyzing ? "Analyzing Frame..." : "Capture Frame"}</span>
                      </button>
                      <span className="text-[11px] text-slate-300 bg-black/70 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                        Click to capture &amp; trigger AI defect inference
                      </span>
                    </div>
                  </>
                )}

                {/* SUB-MODE B: ANALYZED SNAPSHOT VIEW */}
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
                      <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-blue-500/30 text-blue-300 font-mono text-[11px] shadow-lg">
                        <Camera className="w-3 h-3 text-blue-400" />
                        <span className="font-bold">ANALYZED SNAPSHOT</span>
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
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Back to Live Feed</span>
                      </button>
                    </div>

                    {/* Bounding Box Overlay on Frozen Snapshot */}
                    {showBoundingBoxes &&
                      lastResult.boundingBoxes.map((box, idx) => {
                        const isDef = lastResult.status === "defect";
                        return (
                          <div
                            key={idx}
                            className={`absolute rounded-lg flex flex-col justify-between p-1.5 transition-all duration-300 ${
                              isDef
                                ? "border-2 border-rose-500 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.35)]"
                                : "border-2 border-emerald-400 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                            }`}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`,
                            }}
                          >
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded self-start flex items-center gap-1 shadow-xs ${
                                isDef ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
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
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Capture New Frame</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => runAiAnalysis(capturedSnapshot)}
                        disabled={isAnalyzing}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-zinc-100 border border-slate-700 font-medium text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-blue-400 ${
                            isAnalyzing ? "animate-spin" : ""
                          }`}
                        />
                        <span>Re-analyze</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* State Kamera Belum Aktif / Error */
              <div className="flex flex-col items-center justify-center p-6 text-center max-w-md bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-sm">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3.5 text-blue-400">
                  <Video className="w-8 h-8" />
                </div>
                <h4 className="font-sans text-base font-bold text-white mb-1.5">
                  Camera Station Offline
                </h4>
                <p className="font-sans text-xs text-slate-300 mb-4 max-w-sm leading-relaxed">
                  Activate your camera feed to scan casting workpieces in real-time, or toggle the optical conveyor simulation.
                </p>

                {cameraError && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left flex items-start gap-2 max-w-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
                  <button
                    onClick={startCamera}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer border border-slate-700"
                  >
                    <Video className="w-4 h-4" />
                    <span>Start Camera Feed</span>
                  </button>

                  <button
                    onClick={startSimulatedFeed}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    title="Run conveyor simulation if camera is unavailable"
                  >
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span>Simulate Conveyor Feed</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Optical HUD Framing Corners */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400/60 pointer-events-none" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400/60 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400/60 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400/60 pointer-events-none" />

        {/* Futuristic Scanline Animation */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.9)] animate-pulse top-1/2 -translate-y-1/2 absolute" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-blue-500/40 text-blue-300 font-mono text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>YOLOv8 &amp; AWS Bedrock Processing Frame...</span>
            </div>
          </div>
        )}

        {/* Shutter White Flash Effect */}
        {isCapturingFlash && (
          <div className="absolute inset-0 bg-white/70 z-50 pointer-events-none transition-opacity duration-200" />
        )}
      </div>

      {/* Bottom Floating Glassmorphic Control Bar */}
      <div className="relative z-30 p-3 sm:p-4 bg-white border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          {activeMode === "upload" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => runAiAnalysis()}
                disabled={!selectedImage || isAnalyzing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                {isAnalyzing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                )}
                <span>{isAnalyzing ? "Analyzing..." : "Analyze Frame"}</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                title="Browse local files"
              >
                <FileImage className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedImage ? "Replace Image" : "Browse Local Files"}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {cameraViewMode === "live" ? (
                <>
                  <button
                    onClick={handleCaptureFrame}
                    disabled={!isCameraActive || isAnalyzing}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture &amp; Detect</span>
                  </button>

                  <button
                    onClick={() => setIsContinuousScan((prev) => !prev)}
                    disabled={!isCameraActive}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      isContinuousScan
                        ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                        : "bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50"
                    }`}
                    title="Auto scan every 4 seconds"
                  >
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    <span>Auto Scan (4s)</span>
                  </button>

                  {isCameraActive && (
                    <button
                      onClick={stopCamera}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Stop camera stream"
                    >
                      <VideoOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Stop Camera</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setCameraViewMode("live")}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Back to Live Feed</span>
                  </button>

                  <button
                    onClick={() => runAiAnalysis(capturedSnapshot || undefined)}
                    disabled={isAnalyzing}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-slate-500 ${
                        isAnalyzing ? "animate-spin" : ""
                      }`}
                    />
                    <span>Re-analyze</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Toggle Bounding Box Button */}
          <button
            onClick={() => setShowBoundingBoxes((prev) => !prev)}
            className={`p-2 rounded-xl border transition-all cursor-pointer shadow-xs ${
              showBoundingBoxes
                ? "bg-blue-50 text-blue-700 border-blue-200/80"
                : "bg-white text-slate-500 border-slate-200/80 hover:bg-slate-50"
            }`}
            title="Toggle AI Bounding Boxes"
          >
            {showBoundingBoxes ? (
              <Eye className="w-4 h-4 text-blue-600" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Right Status Result Badge */}
        <div className="flex items-center gap-2 text-xs">
          {lastResult.status !== "idle" ? (
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-medium shadow-xs ${
                lastResult.status === "defect"
                  ? "bg-rose-50 text-rose-700 border-rose-200/80"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200/80"
              }`}
            >
              {lastResult.status === "defect" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span className="font-semibold">{lastResult.defectClass}</span>
              <span className="text-slate-300">|</span>
              <span className="tabular-nums">{lastResult.confidence}%</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500 flex items-center gap-2 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Awaiting Frame</span>
            </div>
          )}

          {lastResult.status !== "idle" && lastResult.sapTickets.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-medium">
              <Send className="w-3 h-3 text-blue-600" />
              <span>SAP ERP Dispatched</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

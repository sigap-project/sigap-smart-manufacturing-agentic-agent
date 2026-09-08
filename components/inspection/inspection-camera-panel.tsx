"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  Eye,
  EyeOff,
  Camera,
  Scan,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// =========================================================================
// TODO: BACKEND & AI INTEGRATION GUIDE
// -------------------------------------------------------------------------
// 1. Edge Camera Feed (RTSP / WebRTC / HLS):
//    - Mount video or WebGL canvas element here.
//    - Stream protocol: WebRTC (sub-second latency) or HLS via MediaSource.
//    - Edge AI Camera: Station #01 (Conveyor Optical Inspection)
//    - Feed URI: ws://<edge-device-ip>:8554/live/station-01
// 2. Real-Time Inference (YOLOv8-Nano / TensorRT):
//    - Defect detection bounding boxes & confidence score:
//      { x, y, width, height, label, confidence, timestamp }
//    - Subscribe to WebSocket / SSE endpoint: /api/v1/stream/station-01/telemetry
// 3. Automated S3 Snapshot Capture:
//    - Trigger snapshot uploads to AWS S3 bucket: s3://sigap-defects/station-01/
// =========================================================================

export function InspectionCameraPanel() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [isCapturing, setIsCapturing] = useState(false);

  // TODO: Send play/pause signaling to Edge AI stream via WebSocket
  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // TODO: Send capture command to Edge Camera API to grab uncompressed RAW frame and upload to S3
  const triggerSnapshot = () => {
    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 300);
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-[#07090e] border border-white/[0.08] shadow-2xl flex flex-col min-h-[500px] sm:min-h-[580px] lg:min-h-[640px] select-none group">
      {/* 
        // =========================================================================
        // TODO: BACKEND & AI INTEGRATION
        // Connect live RTSP / WebRTC / HLS video stream from Edge AI Camera.
        // Endpoint example: ws://<edge-device-ip>:8554/live/station-01
        // Camera source: Station #01 (Conveyor Optical Inspection)
        // Inference engine: YOLOv8-Nano (Metal Casting Defect Detection)
        // =========================================================================
      */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-[#06080d]">
        {/* High-Tech Optical Sensor Grid & Crosshair Placeholder */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem]" />

        {/* Center Optical Sensor Calibration Watermark */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
          <div className="w-24 h-24 rounded-full border border-dashed border-emerald-500/30 flex items-center justify-center mb-3">
            <Scan className="w-10 h-10 text-emerald-400/60 stroke-[1.5]" />
          </div>
          <span className="font-mono text-xs tracking-widest text-zinc-400 uppercase">
            CAM-01 • OPTICAL SENSOR FEED
          </span>
          <span className="font-mono text-[10px] text-emerald-500/80 mt-1">
            // TODO: Connect WebRTC / RTSP stream from Edge AI
          </span>
        </div>

        {/* Ambient Vignette Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#050608_95%)] pointer-events-none" />

        {/* Fine Scanline Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-40" />

        {/* Simulated Snapshot White Flash */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white/40 z-30 pointer-events-none transition-opacity duration-300" />
        )}
      </div>

      {/* Optical HUD & Bounding Boxes Layer */}
      {showBoundingBoxes && (
        <div className="absolute inset-0 z-10 pointer-events-none p-6 sm:p-8">
          {/* Viewport Corner Brackets (High-Tech HUD styling) */}
          <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-emerald-400/70" />
          <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-emerald-400/70" />
          <div className="absolute bottom-20 left-5 w-6 h-6 border-b-2 border-l-2 border-emerald-400/70" />
          <div className="absolute bottom-20 right-5 w-6 h-6 border-b-2 border-r-2 border-emerald-400/70" />

          {/* Animated Horizontal Laser Scan Beam */}
          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-pulse top-1/2 -translate-y-12 pointer-events-none" />

          {/* Bounding Box 1: Anomali Cacat (Defect Detected) */}
          <div
            className="absolute left-[44%] sm:left-[48%] top-[38%] sm:top-[40%] w-32 sm:w-36 h-32 sm:h-36 border-2 border-amber-400 bg-amber-500/10 rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col justify-between p-1.5 animate-pulse"
          >
            {/* Box Header Tag */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 flex items-center gap-1 shadow-sm">
                <AlertTriangle className="w-2.5 h-2.5" />
                warna_abnormal [94.2%]
              </span>
            </div>

            {/* Micro Crosshairs */}
            <div className="flex items-center justify-between text-[8px] font-mono text-amber-300">
              <span>X: 524</span>
              <span>Y: 312</span>
            </div>
          </div>

          {/* Bounding Box 2: Produk OK (Passed Clean Part) */}
          <div
            className="absolute left-[16%] sm:left-[20%] top-[50%] sm:top-[52%] w-28 sm:w-32 h-28 sm:h-32 border-2 border-emerald-400/80 bg-emerald-500/10 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)] flex flex-col justify-between p-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                produk_ok [99.1%]
              </span>
            </div>

            <div className="flex items-center justify-between text-[8px] font-mono text-emerald-300">
              <span>X: 218</span>
              <span>Y: 410</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Overlay Badges */}
      <div className="relative z-20 p-4 sm:p-6 flex items-center justify-between gap-3">
        {/* Left Live Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-xs text-white shadow-xl">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="font-mono text-[11px] font-bold tracking-wider text-red-400 uppercase">
            LIVE FEED
          </span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-[11px] text-zinc-300">
            STATION-01 • LOT #B-2026-0730
          </span>
        </div>

        {/* Right Telemetry Spec Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 font-mono text-[11px] text-zinc-300 shadow-xl">
          <span className="text-emerald-400 font-semibold">60 FPS</span>
          <span className="text-zinc-600">•</span>
          <span>1080p</span>
          <span className="text-zinc-600">•</span>
          <span className="text-cyan-300">78ms YOLOv8-Nano</span>
        </div>
      </div>

      {/* Bottom Floating Glassmorphic Control Bar */}
      <div className="relative z-20 p-4 sm:p-6 mt-auto flex justify-center">
        <div className="w-full max-w-xl flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2.5 rounded-2xl sm:rounded-full bg-[#07090e]/85 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/90 text-xs text-zinc-200">
          {/* Play / Pause Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Jeda Stream Kamera" : "Putar Stream Kamera"}
              className="p-2 rounded-full bg-white/10 hover:bg-emerald-500 hover:text-zinc-950 text-white transition-all cursor-pointer shadow-md"
              title={isPlaying ? "Jeda Feed" : "Putar Feed"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            <span className="font-mono text-[11px] text-zinc-300 hidden sm:inline">
              {isPlaying ? "Streaming Aktif" : "Stream Dijeda"}
            </span>
          </div>

          <span className="hidden sm:block h-4 w-[1px] bg-white/15" />

          {/* Confidence Threshold Readout & Stepper */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">
              Threshold:
            </span>
            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
              <span className="font-mono text-[11px] font-bold text-emerald-400">
                {confidenceThreshold}%
              </span>
              <button
                onClick={() =>
                  setConfidenceThreshold((prev) => (prev >= 95 ? 70 : prev + 5))
                }
                className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors"
                title="Sesuaikan Threshold Minimal"
              >
                +5%
              </button>
            </div>
          </div>

          <span className="hidden sm:block h-4 w-[1px] bg-white/15" />

          {/* Bounding Boxes Toggle Button */}
          <button
            onClick={() => setShowBoundingBoxes((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[11px] transition-all cursor-pointer ${
              showBoundingBoxes
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold"
                : "bg-white/5 text-zinc-400 border border-white/10 hover:text-white"
            }`}
            title="Sembunyikan / Tampilkan Bounding Box AI"
          >
            {showBoundingBoxes ? (
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span>Bounding Box</span>
          </button>

          {/* Snapshot Capture Button */}
          <button
            onClick={triggerSnapshot}
            aria-label="Ambil Snapshot Bukti S3"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Simpan Frame Snapshot S3"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

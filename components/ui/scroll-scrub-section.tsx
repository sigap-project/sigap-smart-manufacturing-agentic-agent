"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";

export interface ScrollScrubStep {
  id: string;
  rangeStart: number; // 0.0 - 1.0
  rangeEnd: number; // 0.0 - 1.0
  title: string; // e.g. "01. SCAN"
  description: string; // single concise sentence
}

export interface ScrollScrubSectionProps {
  eyebrow: string; // e.g. "ARSITEKTUR OTONOM END-TO-END"
  heading: string; // e.g. "The 5-Step Autonomous Loop"
  framePathPattern: string; // e.g. "/animation/ezgif-frame-{n}.jpg"
  frameCount: number; // e.g. 294
  padLength?: number; // default 3 ("001")
  steps: ScrollScrubStep[];
  scrollHeightMultiplier?: number; // default 5 (500vh)
  className?: string;
}

export function ScrollScrubSection({
  eyebrow,
  heading,
  framePathPattern,
  frameCount,
  padLength = 3,
  steps,
  scrollHeightMultiplier = 5,
  className = "",
}: ScrollScrubSectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const lastRenderedIndex = useRef<number>(-1);

  // Helper to format frame path
  const getFrameUrl = useCallback(
    (index: number) => {
      const numStr = String(index + 1).padStart(padLength, "0");
      return framePathPattern.replace("{n}", numStr);
    },
    [framePathPattern, padLength]
  );

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Canvas drawing function with true edge-to-edge cover fit and DPR handling
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const img = imagesRef.current[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    if (lastRenderedIndex.current === index) return;
    lastRenderedIndex.current = index;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const targetW = Math.round(winW * dpr);
    const targetH = Math.round(winH * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = winW / winH;

    let renderW: number;
    let renderH: number;
    let offsetX: number;
    let offsetY: number;

    if (canvasRatio > imgRatio) {
      renderW = winW;
      renderH = winW / imgRatio;
      offsetX = 0;
      offsetY = (winH - renderH) / 2;
    } else {
      renderH = winH;
      renderW = winH * imgRatio;
      offsetX = (winW - renderW) / 2;
      offsetY = 0;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    ctx.restore();
  }, []);

  // Preload frame images
  useEffect(() => {
    imagesRef.current = new Array(frameCount).fill(null);
    let isCancelled = false;

    // 1. Preload frame 0 immediately so it displays instantly
    const firstImg = new Image();
    firstImg.src = getFrameUrl(0);
    firstImg.onload = () => {
      if (isCancelled) return;
      imagesRef.current[0] = firstImg;
      drawFrame(0);
    };

    // 2. Preload remaining frames concurrently in batches
    const batchSize = 14;
    let currentIndex = 1;

    const loadBatch = () => {
      if (isCancelled || currentIndex >= frameCount) return;

      const end = Math.min(currentIndex + batchSize, frameCount);
      for (let i = currentIndex; i < end; i++) {
        const img = new Image();
        img.src = getFrameUrl(i);
        img.onload = () => {
          if (isCancelled) return;
          imagesRef.current[i] = img;
        };
      }
      currentIndex = end;
      if (currentIndex < frameCount) {
        setTimeout(loadBatch, 25);
      }
    };

    loadBatch();

    return () => {
      isCancelled = true;
    };
  }, [frameCount, getFrameUrl, drawFrame]);

  // Framer Motion useScroll hooked directly to the container boundary
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Track scroll progress with high precision, perfectly synced to Lenis
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (prefersReducedMotion) return;

    const clamped = Math.min(Math.max(latest, 0), 1);
    setScrollProgress(clamped);

    const frameIdx = Math.min(
      Math.max(Math.floor(clamped * (frameCount - 1)), 0),
      frameCount - 1
    );

    setCurrentFrameIndex(frameIdx);
    drawFrame(frameIdx);
  });

  // Resize listener to re-render the active frame with updated dimensions
  useEffect(() => {
    const handleResize = () => {
      lastRenderedIndex.current = -1;
      drawFrame(currentFrameIndex);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [drawFrame, currentFrameIndex]);

  // Sync initial scroll progress on mount if page is already scrolled
  useEffect(() => {
    if (prefersReducedMotion) return;
    const initialProgress = scrollYProgress.get();
    if (typeof initialProgress === "number" && !isNaN(initialProgress)) {
      const clamped = Math.min(Math.max(initialProgress, 0), 1);
      setScrollProgress(clamped);
      const frameIdx = Math.min(
        Math.max(Math.floor(clamped * (frameCount - 1)), 0),
        frameCount - 1
      );
      setCurrentFrameIndex(frameIdx);
      drawFrame(frameIdx);
    }
  }, [scrollYProgress, frameCount, drawFrame, prefersReducedMotion]);

  // Active step calculation based on scroll progress
  const activeStep = useMemo(() => {
    const found = steps.find(
      (s) => scrollProgress >= s.rangeStart && scrollProgress <= s.rangeEnd
    );
    if (found) return found;
    if (scrollProgress < steps[0]?.rangeStart) return steps[0];
    return steps[steps.length - 1];
  }, [scrollProgress, steps]);

  // Accessible fallback when user prefers reduced motion
  if (prefersReducedMotion) {
    return (
      <section className={`py-24 px-6 lg:px-12 bg-[#050505] ${className}`}>
        <div className="max-w-4xl mx-auto text-center mb-16">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold mb-3 block">
            {eyebrow}
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-tight">
            {heading}
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-12">
          {steps.map((s) => (
            <div key={s.id} className="text-center py-6 border-b border-white/10 last:border-0">
              <h3 className="font-display text-2xl sm:text-4xl font-bold text-white mb-3">
                {s.title}
              </h3>
              <p className="font-sans text-base sm:text-lg text-zinc-300">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ height: `${scrollHeightMultiplier * 100}vh` }}
    >
      {/* Pinned 100vw x 100vh Full-Bleed Sticky Frame */}
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-[#050505] select-none z-10">
        {/* Full-Bleed Edge-to-Edge Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover block pointer-events-none"
        />

        {/* Multi-layer Cinematic Scrims (Matching Reference Image Aesthetics) */}
        {/* Top Scrim for Persistent Eyebrow & Heading Legibility */}
        <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-[#050505]/90 via-[#050505]/40 to-transparent pointer-events-none z-10" />

        {/* Center Moody Vignette Scrim so Giant Text Pops with High Contrast */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,rgba(5,5,5,0.45)_0%,rgba(5,5,5,0.75)_100%)] pointer-events-none z-10" />

        {/* Bottom Scrim for Step Dots and Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505]/90 via-[#050505]/30 to-transparent pointer-events-none z-10" />

        {/* 1. TOP PINNED OVERLAY: Persistent Eyebrow Badge & Heading */}
        <div className="absolute top-8 sm:top-10 left-0 right-0 flex flex-col items-center text-center px-6 pointer-events-none z-20">
          <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-emerald-400 font-semibold mb-2 drop-shadow-md">
            {eyebrow}
          </span>
          <h2 className="font-display text-lg sm:text-2xl font-bold text-white/90 tracking-tight drop-shadow-lg">
            {heading}
          </h2>
        </div>

        {/* 2. CENTERED CINEMATIC TITLE-CARD: (Matching 'THE CITY OPENS' Treatment) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 sm:px-12 pointer-events-none z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-4xl mx-auto flex flex-col items-center"
            >
              {/* Bold Large Centered White Headline in Clash Display */}
              <h3 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white uppercase drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)]">
                {activeStep.title}
              </h3>

              {/* Single Supporting Line in General Sans */}
              <p className="font-sans text-base sm:text-xl lg:text-2xl text-zinc-200/90 font-normal max-w-2xl mt-5 sm:mt-6 leading-relaxed drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)] text-balance">
                {activeStep.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 3. BOTTOM MINIMAL STEP INDICATOR (5 Small Dashes, 1 Lit Up) */}
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 pointer-events-none">
          {steps.map((s) => {
            const isActive = activeStep.id === s.id;
            return (
              <div
                key={s.id}
                className={`h-1 rounded-full transition-all duration-300 ${
                  isActive
                    ? "w-8 sm:w-10 bg-emerald-400 shadow-sm shadow-emerald-400"
                    : "w-3 sm:w-4 bg-white/25"
                }`}
              />
            );
          })}
        </div>

        {/* 4. BOTTOM-RIGHT SUBTLE ATTRIBUTION (Matching Reference Photo) */}
        <div className="absolute bottom-6 sm:bottom-8 right-6 sm:right-10 font-mono text-[10px] text-zinc-500 tracking-widest uppercase z-20 pointer-events-none hidden sm:block">
          SIGAP // AUTONOMOUS_LOOP
        </div>

        {/* 5. RAZOR-THIN SCROLL PROGRESS LINE AT VERY BOTTOM EDGE */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-75"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

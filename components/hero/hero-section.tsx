"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Radio } from "lucide-react";
import { HeroTypography } from "./hero-typography";
import { AgentTelemetryCard } from "./agent-telemetry-card";

interface HeroSectionProps {
  onOpenDemo?: () => void;
}

export function HeroSection({ onOpenDemo }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);

  // Parallax tracking refs
  const isVisibleRef = useRef(true);
  const targetOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    // Ensure muted & autoplay DOM properties on mount
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, []);

  // Parallax Scroll Engine (Lerp + requestAnimationFrame)
  useEffect(() => {
    // Respect prefers-reduced-motion and coarse pointers (mobile viewports)
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isCoarse =
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;

    if (mediaQuery.matches || isCoarse) {
      if (videoRef.current) {
        videoRef.current.style.transform = "translate3d(0, 0, 0)";
      }
      return;
    }

    const animate = () => {
      if (!isVisibleRef.current) {
        rafIdRef.current = null;
        return;
      }

      // Lerp (linear interpolation) for buttery-smooth fluid inertia
      const diff = targetOffsetRef.current - currentOffsetRef.current;
      currentOffsetRef.current += diff * 0.09;

      if (videoRef.current) {
        videoRef.current.style.transform = `translate3d(0, ${currentOffsetRef.current.toFixed(2)}px, 0)`;
      }

      if (Math.abs(diff) > 0.05) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        currentOffsetRef.current = targetOffsetRef.current;
        if (videoRef.current) {
          videoRef.current.style.transform = `translate3d(0, ${currentOffsetRef.current.toFixed(2)}px, 0)`;
        }
        rafIdRef.current = null;
      }
    };

    const startLoop = () => {
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(animate);
      }
    };

    // IntersectionObserver to pause calculations when hero section is not visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !rafIdRef.current) {
          startLoop();
        }
      },
      { rootMargin: "120px", threshold: 0 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    const handleScroll = () => {
      if (!isVisibleRef.current) return;
      const scrollY = window.scrollY || window.pageYOffset;
      // Drift at ~0.35 factor so the video moves roughly 35% slower than foreground content
      targetOffsetRef.current = Math.max(0, scrollY * 0.35);
      startLoop();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[96vh] flex items-center justify-center overflow-hidden pt-28 sm:pt-32 pb-16 px-6 lg:px-12"
    >
      {/* Seamless Ambient Looping Video Background with Parallax Headroom */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0"
        onMouseEnter={() => setIsHoveringVideo(true)}
        onMouseLeave={() => setIsHoveringVideo(false)}
      >
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onEnded={(e) => {
            e.currentTarget.currentTime = 0;
            e.currentTarget.play().catch(() => {});
          }}
          style={{ willChange: "transform" }}
          className="absolute left-0 right-0 -top-[18%] w-full h-[136%] min-h-[136%] object-cover object-center scale-[1.02] filter brightness-[0.80] contrast-[1.10]"
        >
          <source src="/videos/hero-loop.mp4" type="video/mp4" />
          <source
            src="/videos/Metallic_cubes_circulating_on_track_202609062223.mp4"
            type="video/mp4"
          />
          <source src="/videos/hero-loop.webm" type="video/webm" />
        </video>

        {/* Layer 1: Left-to-Right Scrim (Dark solid behind left text column, transparent on right to see conveyor) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 via-45% to-transparent" />

        {/* Layer 2: Top-to-Bottom Scrim (Fades under navbar and smoothly blends into #050505 below) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/90 via-transparent to-[#050505] via-50%" />

        {/* Layer 3: Subtle Radial Emerald Vignette to match high-tech smart factory mood */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_50%,rgba(16,185,129,0.12),transparent_70%)]" />

        {/* Layer 4: Fine Grid Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70" />
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column (58%): Headline Typography, Value Proposition, Action CTA, Trust Badges */}
          <div className="lg:col-span-7">
            <HeroTypography onOpenDemo={onOpenDemo} />
          </div>

          {/* Right Column (42%): Floating Glassmorphism Telemetry Card over the scanning station */}
          <div className="lg:col-span-5">
            <AgentTelemetryCard onOpenDemo={onOpenDemo} />
          </div>
        </div>
      </div>

      {/* Bottom Floating Telemetry Video Controller Pill */}
      <div className="absolute bottom-6 right-6 sm:right-12 z-20 flex items-center gap-3 px-3.5 py-2 rounded-full bg-[#0d1117]/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/80 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] text-zinc-200 tracking-wider uppercase flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-400 inline" />
            CAM-01 • OPTICAL STATION
          </span>
        </div>

        <span className="h-3 w-[1px] bg-white/15" />

        <span className="font-mono text-[11px] text-emerald-400 font-semibold">
          60 FPS
        </span>

        <span className="h-3 w-[1px] bg-white/15" />

        {/* Play/Pause Button */}
        <button
          onClick={toggleVideoPlayback}
          aria-label={
            isPlaying ? "Pause background feed" : "Play background feed"
          }
          className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title={isPlaying ? "Jeda Feed Video" : "Putar Feed Video"}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-zinc-300" />
          ) : (
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          )}
        </button>
      </div>

      {/* Bottom subtle ambient gradient divider line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent pointer-events-none" />
    </section>
  );
}

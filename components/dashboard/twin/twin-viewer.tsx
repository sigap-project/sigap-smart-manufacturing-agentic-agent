"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with ssr: false to prevent hydration mismatches with WebGL canvas
const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
  loading: () => <TwinLoadingSkeleton />,
});

function TwinLoadingSkeleton() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#E1E7ED] overflow-hidden"
      style={{ backgroundColor: "#E1E7ED" }}
    >
      <div className="relative flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-slate-300 border-t-cyan-500 animate-spin" />
          <Loader2 className="w-6 h-6 text-cyan-600 animate-pulse absolute" />
        </div>
        <div className="text-center">
          <p className="font-mono text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Loading SIGAP Digital Twin
          </p>
          <p className="font-sans text-[11px] text-slate-500 mt-0.5">
            Initialising WebGL canvas & Flowos diorama...
          </p>
        </div>
      </div>
    </div>
  );
}

import { useTwinRobotController, TwinState } from "./use-twin-robot-controller";

interface TwinViewerProps {
  systemState: TwinState;
  onSplineLoaded?: (splineApp: any) => void;
  onStateChangeFromTwin?: (state: string) => void;
}

export function TwinViewer({
  systemState,
  onSplineLoaded,
  onStateChangeFromTwin,
}: TwinViewerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [splineApp, setSplineApp] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const splineAppRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Native high-framerate 3D robot kinematics & waypoint controller (paused when offscreen)
  useTwinRobotController(splineApp, systemState, isVisible);

  // Synchronize systemState to Spline application variable & scene key triggers
  useEffect(() => {
    if (splineAppRef.current) {
      const app = splineAppRef.current;
      const vars = typeof app.getVariables === "function" ? app.getVariables() : [];
      const hasVar = Array.isArray(vars) && vars.some((v: any) => v && v.name === "systemState");
      if (hasVar && typeof app.setVariable === "function") {
        try {
          app.setVariable("systemState", systemState);
        } catch {
          // silent
        }
      }

      // Dispatch direct keyboard event to embedded scene controller (1: idle, 2: scanning, 3: ok, 4: defect)
      const keyMap: Record<string, string> = { idle: "1", scanning: "2", ok: "3", defect: "4" };
      const key = keyMap[systemState];
      if (key && typeof window !== "undefined") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key }));
      }
    }
  }, [systemState]);

  // Track viewport visibility to pause expensive WebGL rendering when scrolled down to Analytics
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Performance optimization: Temporarily disable canvas pointer events during active scrolling
  // This prevents expensive WebGL raycasting and collision calculations on every scroll pixel
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const scrollContainer = containerRef.current?.closest("main") || window;

    const onScroll = () => {
      setIsScrolling(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setIsScrolling(false);
      }, 140);
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleLoad = (app: any) => {
    if (!app) return;
    splineAppRef.current = app;
    setSplineApp(app);
    setIsLoaded(true);
    setLoadError(false);

    // Initial variable set if present in scene
    try {
      const vars = typeof app.getVariables === "function" ? app.getVariables() : [];
      const hasVar = Array.isArray(vars) && vars.some((v: any) => v && v.name === "systemState");
      if (hasVar && typeof app.setVariable === "function") {
        app.setVariable("systemState", systemState);
      }
    } catch {
      // ignore
    }

    // Listen to variable changes originating from the Spline scene
    if (typeof app.addEventListener === "function") {
      try {
        app.addEventListener("variableChange", ({ name, value }: any) => {
          if (name === "systemState" && onStateChangeFromTwin) {
            onStateChangeFromTwin(value);
          }
        });
      } catch {
        // ignore
      }
    }

    // Calibrate camera framing to keep the diorama centered and spacious
    try {
      const cam = app._camera || app.camera;
      if (cam) {
        if (typeof cam.updateProjectionMatrix === "function") {
          cam.updateProjectionMatrix();
        }
        if (typeof app.requestRender === "function") {
          app.requestRender();
        }
      }
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      (window as any).splineApp = app;
    }

    if (onSplineLoaded) {
      onSplineLoaded(app);
    }
  };

  // Fluid scroll & deliberate zoom decoupling:
  // - Regular mouse wheel / touchpad scroll passes through to scroll the page smoothly at 60fps
  // - Holding Ctrl / Cmd (or pinch-to-zoom) activates 3D camera zoom smoothly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If user holds Ctrl / Cmd (deliberate zoom or pinch gesture), zoom 3D camera
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const app = splineAppRef.current;
        if (app) {
          const cam = app._camera || app.camera;
          if (cam && typeof cam.zoom === "number") {
            const factor = e.deltaY < 0 ? 1.05 : 0.95;
            const nextZoom = Math.min(Math.max(cam.zoom * factor, 0.4), 3.5);
            cam.zoom = nextZoom;
            if (typeof cam.updateProjectionMatrix === "function") {
              cam.updateProjectionMatrix();
            }
            if (typeof app._requestRenderAutoMode === "function") {
              app._requestRenderAutoMode();
            }
          }
        }
        return;
      }

      // Normal scroll (without Ctrl / Cmd):
      // In capture phase, stop immediate propagation to children so internal Three.js canvas listeners
      // cannot call e.preventDefault(), allowing native DOM scrolling to bubble cleanly without stuttering!
      e.stopImmediatePropagation();
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent browser scroll during multi-touch gestures (e.g. 2-finger pinch inside diorama)
      if (e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel, { capture: true } as any);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#E1E7ED] select-none touch-pan-y"
      style={{ backgroundColor: "#E1E7ED" }}
    >
      {!isLoaded && !loadError && <TwinLoadingSkeleton />}

      {loadError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
          <p className="font-mono text-sm text-rose-400 font-semibold mb-1">
            Gagal Memuat 3D Canvas
          </p>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            WebGL atau file scene tidak dapat dimuat. Pastikan peramban mendukung akselerasi 3D.
          </p>
          <button
            onClick={() => setLoadError(false)}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <div
          className={`w-full h-[calc(100%+110px)] -mb-[110px] relative overflow-hidden transition-[pointer-events] duration-75 ${
            isScrolling ? "pointer-events-none" : "pointer-events-auto"
          }`}
        >
          <Spline
            scene="/spline/sigap-twin.splinecode"
            onLoad={handleLoad}
            onError={() => {
              console.warn("[TwinViewer] Local scene failed, falling back to CDN...");
            }}
          />
        </div>
      )}
    </div>
  );
}

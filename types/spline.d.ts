declare module "@splinetool/react-spline" {
  import React from "react";

  export interface SplineProps {
    scene: string;
    onLoad?: (splineApp: unknown) => void;
    onError?: (error?: unknown) => void;
    className?: string;
    style?: React.CSSProperties;
  }

  const Spline: React.ComponentType<SplineProps>;
  export default Spline;
}

import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@splinetool/react-spline"],
  webpack: (config) => {
    config.resolve.conditionNames = [
      ...(config.resolve.conditionNames || []),
      "import",
    ];
    return config;
  },
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/internal/inspection-result": ["./ai_models/model-manifest.json"],
    "/api/inspection/analyze": [
      "./ai_models/model-manifest.json",
      "./ai_models/sigap-casting-yolov8-cls.onnx",
      "./ai_models/sigap-casting-yolov8-detect.onnx",
      // The binding dlopen()s libonnxruntime.so at runtime, which file tracing cannot see.
      // Ship only the deploy target's folder to stay inside the Amplify size limit.
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*",
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/ffmpeg-static/**/*",
      "node_modules/prisma/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_*.so",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/batch-board",
        destination: "/dashboard/batches",
        permanent: true,
      },
      {
        source: "/dashboard/export-dispatch",
        destination: "/dashboard/dispatch",
        permanent: true,
      },
      {
        source: "/dashboard/lot-history",
        destination: "/dashboard/history",
        permanent: true,
      },
      {
        source: "/batch-board",
        destination: "/dashboard/batches",
        permanent: true,
      },
      {
        source: "/dispatch",
        destination: "/dashboard/dispatch",
        permanent: true,
      },
      {
        source: "/lot-history",
        destination: "/dashboard/history",
        permanent: true,
      },
      {
        source: "/inspection",
        destination: "/dashboard/inspection",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/dashboard/settings",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;


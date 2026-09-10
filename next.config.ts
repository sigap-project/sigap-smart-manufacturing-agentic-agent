import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingExcludes: {
    "*": [
      "node_modules/ffmpeg-static/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**/*",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*",
      "node_modules/prisma/**/*",
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


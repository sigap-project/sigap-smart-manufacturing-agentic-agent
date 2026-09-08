import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LenisProvider } from "@/components/providers/lenis-provider";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SIGAP — Sistem Agen Otonom Deteksi Cacat & Respons Kualitas Real-Time",
  description:
    "Agentic AI Quality Control system untuk SME Manufaktur Pengecoran Logam. Menghubungkan deteksi computer vision langsung ke aksi SAP QM, MM, dan PP secara otonom.",
  keywords: [
    "SIGAP",
    "Agentic AI",
    "Smart Manufacturing",
    "Computer Vision",
    "YOLOv8",
    "AWS Bedrock",
    "SAP QM",
    "Quality Control",
  ],
  authors: [{ name: "SIGAP Engineering Team - SOKRATES × BINUS 2026" }],
  icons: {
    icon: "/image/image.png",
    shortcut: "/image/image.png",
    apple: "/image/image.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jetbrainsMono.variable} dark`}>
      <head>
        <link rel="icon" href="/image/image.png" type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href="/image/image.png" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-[#050505] text-zinc-100 font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}

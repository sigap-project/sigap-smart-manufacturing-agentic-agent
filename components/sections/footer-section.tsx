"use client";

import Image from "next/image";
import { ArrowUp, Github, Sparkles } from "lucide-react";

interface FooterSectionProps {
  onOpenDemo?: () => void;
}

export function FooterSection({ onOpenDemo }: FooterSectionProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer id="sejarah" className="border-t border-white/[0.08] bg-[#050505] pt-16 pb-12 px-6 lg:px-12 relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-12 pb-12 border-b border-white/[0.08]">
          {/* Left Brand info */}
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1px] flex items-center justify-center shadow-md shadow-emerald-500/20">
                <div className="w-full h-full bg-[#090b10] rounded-[11px] flex items-center justify-center overflow-hidden">
                  <Image
                    src="/image/image.png"
                    alt="SIGAP Mascot"
                    width={36}
                    height={36}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">SIGAP</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Sistem Agen Otonom Deteksi Cacat &amp; Respons Kualitas Real-Time untuk Manufaktur SME. Diciptakan khusus untuk kompetisi <strong>AI Agentic Hackathon SOKRATES &times; BINUS 2026</strong> (Track: Intelligence Manufacturing).
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenDemo}
                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs tracking-wide flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buka Demo Supervisor</span>
              </button>
            </div>
          </div>

          {/* Right Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Modul Solusi</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><a href="#loop" className="hover:text-white transition-colors">Optical Scanner (YOLOv8)</a></li>
                <li><a href="#loop" className="hover:text-white transition-colors">Bedrock Reasoning Agent</a></li>
                <li><a href="#loop" className="hover:text-white transition-colors">Batch Quarantine Board</a></li>
                <li><a href="#sap" className="hover:text-white transition-colors">SAP Enterprise Dispatch</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Kemitraan Teknis</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><span className="text-zinc-300">AWS Bedrock Agents</span></li>
                <li><span className="text-zinc-300">SAP CAP (OData v4)</span></li>
                <li><span className="text-zinc-300">ONNX Runtime</span></li>
                <li><span className="text-zinc-300">Next.js 15+ &amp; React 19</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Kompetisi</h4>
              <p className="text-zinc-400 leading-relaxed">
                SOKRATES &times; BINUS Alam Sutera<br />
                Demo Day: 31 Okt 2026<br />
                Kategori: SME Manufacturing
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>&copy; 2026 SIGAP Team. Hak Cipta Dilindungi Undang-Undang.</p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <span>Kembali ke atas</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}

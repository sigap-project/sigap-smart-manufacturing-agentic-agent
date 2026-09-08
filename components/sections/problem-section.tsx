"use client";

import { AlertOctagon, Clock, DollarSign, ArrowRight } from "lucide-react";

export function ProblemSection() {
  const problems = [
    {
      stat: "18.4%",
      label: "Defect Leakage QC Manual",
      desc: "Cacat permukaan mikro pada casting logam sering lolos dari inspeksi mata manusia setelah shift 4 jam, memicu klaim retur fatal dari industri otomotif.",
      icon: AlertOctagon,
      textAccent: "text-red-400",
      textGlow: "drop-shadow-[0_0_16px_rgba(248,113,113,0.30)]",
      cardGradient: "bg-gradient-to-br from-[#0c0d14] via-[#0e1017] to-[#1a0e12]",
      cardBorder: "border-red-500/15 hover:border-red-500/40",
      cardShadow: "hover:shadow-[0_20px_40px_-12px_rgba(239,68,68,0.20)]",
      radialGlow: "bg-red-500/20",
      badgeBg: "bg-[#140b0e]/70",
      badgeBorder: "border-red-500/30",
    },
    {
      stat: "4.2 Jam",
      label: "Latency Eskalasi Manual",
      desc: "Ketika cacat ditemukan, notifikasi ke procurement (vendor bahan baku) dan planning masih manual via WhatsApp/Excel. Lini produksi terus mencetak barang reject.",
      icon: Clock,
      textAccent: "text-amber-400",
      textGlow: "drop-shadow-[0_0_16px_rgba(251,191,36,0.30)]",
      cardGradient: "bg-gradient-to-br from-[#0c0d14] via-[#0e1017] to-[#1a140b]",
      cardBorder: "border-amber-500/15 hover:border-amber-500/40",
      cardShadow: "hover:shadow-[0_20px_40px_-12px_rgba(245,158,11,0.20)]",
      radialGlow: "bg-amber-500/20",
      badgeBg: "bg-[#161208]/70",
      badgeBorder: "border-amber-500/30",
    },
    {
      stat: "Rp 450 Jt+",
      label: "Estimasi Biaya Rework / Kuartal",
      desc: "Beban finansial SME pengecoran untuk peleburan ulang (remelting), scrap loss, penalti keterlambatan delivery, dan penurunan grade supplier.",
      icon: DollarSign,
      textAccent: "text-emerald-400",
      textGlow: "drop-shadow-[0_0_16px_rgba(52,211,153,0.30)]",
      cardGradient: "bg-gradient-to-br from-[#0c0d14] via-[#0e1017] to-[#0a1813]",
      cardBorder: "border-emerald-500/15 hover:border-emerald-500/40",
      cardShadow: "hover:shadow-[0_20px_40px_-12px_rgba(16,185,129,0.20)]",
      radialGlow: "bg-emerald-500/20",
      badgeBg: "bg-[#091511]/70",
      badgeBorder: "border-emerald-500/30",
    },
  ];

  return (
    <section id="solusi" className="py-24 px-6 lg:px-12 relative border-t border-white/[0.06] bg-[#07090e]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 inline-block mb-4">
            Akar Masalah Industri SME
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Mengapa Dashboard QC Konvensional Tidak Lagi Cukup?
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed">
            Dashboard analitik biasa hanya <em>menampilkan grafik</em>. Sementara itu, barang cacat terus berjalan di ban berjalan, supplier bermasalah tidak ter-flag, dan jadwal produksi tidak otomatis disesuaikan.
          </p>
        </div>

        {/* 3 Redesigned Problem Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {problems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`relative rounded-3xl p-8 flex flex-col justify-between border ${item.cardGradient} ${item.cardBorder} ${item.cardShadow} hover:-translate-y-1.5 transition-all duration-300 ease-out`}
              >
                <div>
                  {/* Top Header: Circular Badge with Soft Radial Glow & Monospace Problem Label */}
                  <div className="flex items-center justify-between mb-8">
                    {/* Badge Wrapper with Soft Radial Glow */}
                    <div className="relative flex items-center justify-center">
                      <div
                        className={`absolute w-10 h-10 rounded-full ${item.radialGlow} blur-md pointer-events-none`}
                      />
                      <div
                        className={`relative w-12 h-12 rounded-full ${item.badgeBg} border ${item.badgeBorder} flex items-center justify-center backdrop-blur-sm shadow-sm`}
                      >
                        <Icon className={`w-5 h-5 ${item.textAccent}`} />
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
                      Problem #0{idx + 1}
                    </span>
                  </div>

                  {/* Luminous Stat Number with Soft Drop Shadow Glow */}
                  <h3
                    className={`text-4xl sm:text-5xl font-bold tracking-tight mb-3 font-mono ${item.textAccent} ${item.textGlow}`}
                  >
                    {item.stat}
                  </h3>

                  {/* Title */}
                  <h4 className="text-base font-bold text-white mb-2.5 tracking-normal">
                    {item.label}
                  </h4>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 leading-relaxed font-sans">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Solution Bridge Banner (Untouched) */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-cyan-950/40 border border-emerald-500/30 p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-300 font-semibold mb-2 block">
              Jawaban SIGAP: Otonomi Aksi
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
              Menutup Gap antara Deteksi Kamera dan Sistem Bisnis ERP
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed">
              SIGAP memberdayakan AWS Bedrock Agent untuk mengambil keputusan pola, mengkarantina batch, dan mengeksekusi tindakan nyata ke SAP QM, MM, dan PP secara otonom dalam hitungan milidetik.
            </p>
          </div>

          <a
            href="#loop"
            className="shrink-0 px-6 py-3.5 rounded-full bg-white text-zinc-950 font-bold text-xs tracking-wider flex items-center gap-2 hover:bg-zinc-100 transition-all shadow-xl active:scale-95"
          >
            <span>PELAJARI 5-STEP LOOP</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

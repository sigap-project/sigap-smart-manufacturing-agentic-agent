"use client";

import { ShieldCheck, Package, CalendarClock } from "lucide-react";

export function SapArchitectureSection() {
  const sapServices = [
    {
      module: "SAP QM",
      title: "Quality Management",
      icon: ShieldCheck,
      endpoint: "POST /QualityNotification",
      desc: "Secara instan menerbitkan tiket notifikasi cacat beserta foto bukti S3, confidence level, dan kelas cacat casting.",
      outcome: "Notifikasi terbit dalam hitungan detik, lengkap dengan bukti foto dan level keparahan.",
    },
    {
      module: "SAP MM",
      title: "Materials Management",
      icon: Package,
      endpoint: "PATCH /SupplierRecord/{id}",
      desc: "Menambahkan flag 'UnderReview' pada vendor supplier bahan baku scrap/ingot yang menghasilkan anomali berulang.",
      outcome: "Vendor bermasalah otomatis ditandai untuk evaluasi pengadaan sebelum pesanan bahan berikutnya dirilis.",
    },
    {
      module: "SAP PP",
      title: "Production Planning",
      icon: CalendarClock,
      endpoint: "POST /RescheduleRequest",
      desc: "Mengajukan penyesuaian jadwal lini cetak casting untuk mencegah pemborosan energi furnace peleburan.",
      outcome: "Jadwal lini cetak casting langsung disesuaikan secara otonom untuk mencegah pemborosan energi furnace.",
    },
  ];

  return (
    <section id="sap" className="py-24 px-6 lg:px-12 relative bg-[#07090e] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 inline-block mb-4">
            Integrasi Enterprise-Grade
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            AWS Bedrock Agent &times; SAP OData v4 Integration
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed">
            Arsitektur backend SIGAP dibangun API-compatible dengan standar resmi SAP CAP (Cloud Application Programming). Ketika agent mendeteksi cacat berulang, Lambda Action Groups mengeksekusi mutasi langsung ke modul bisnis.
          </p>
        </div>

        {/* 3 Redesigned SAP Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {sapServices.map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <div
                key={idx}
                className="relative rounded-3xl p-7 flex flex-col justify-between border bg-gradient-to-br from-[#0b0e14] via-[#0d1218] to-[#091813] border-emerald-500/15 hover:border-emerald-500/40 hover:shadow-[0_20px_40px_-12px_rgba(16,185,129,0.20)] hover:-translate-y-1.5 transition-all duration-300 ease-out"
              >
                <div>
                  {/* Top Header: Circular Icon Badge with Emerald Radial Glow & Module Tag */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="relative flex items-center justify-center">
                      {/* Soft radial glow behind circular badge */}
                      <div className="absolute w-10 h-10 rounded-full bg-emerald-500/20 blur-md pointer-events-none" />
                      {/* Glassy circular badge */}
                      <div className="relative w-12 h-12 rounded-full bg-[#0c1412]/80 border border-emerald-500/30 flex items-center justify-center backdrop-blur-sm shadow-sm">
                        <Icon className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-bold tracking-wide">
                      {srv.module}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white mb-1.5 tracking-tight">
                    {srv.title}
                  </h3>

                  {/* Endpoint Badge */}
                  <div className="text-[11px] font-mono text-cyan-400 mb-3.5 bg-cyan-950/30 px-2.5 py-1 rounded-md border border-cyan-500/20 w-fit">
                    {srv.endpoint}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-sans">
                    {srv.desc}
                  </p>
                </div>

                {/* Plain-Language Concrete Outcome (Replacing Raw JSON Payload) */}
                <div className="pt-4 border-t border-white/[0.08] flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {srv.outcome}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Autonomy Spectrum Card (Responsible AI) */}
        <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-zinc-950">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-2 block">
                Responsible Agentic AI
              </span>
              <h3 className="text-2xl font-bold text-white mb-2">
                Spektrum Otonomi yang Dapat Dikonfigurasi
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Pabrik tidak dipaksa mempercayakan 100% kendali ke AI. Operator dapat memilih antara <strong>Require Human Approval</strong> (agent menyusun draft, manusia menekan tombol kirim) atau <strong>Full Auto</strong> saat lini berjalan pada malam hari (lights-out manufacturing).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-center w-full sm:w-44">
                <span className="text-xs font-mono text-amber-400 uppercase font-bold block mb-1">
                  Human-in-the-Loop
                </span>
                <span className="text-[11px] text-zinc-400">5-Min SLA Approval</span>
              </div>

              <div className="text-zinc-500 font-mono text-xs hidden sm:block">
                ↔
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center w-full sm:w-44">
                <span className="text-xs font-mono text-emerald-400 uppercase font-bold block mb-1">
                  Full Autonomous
                </span>
                <span className="text-[11px] text-zinc-300">Instant Execution</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

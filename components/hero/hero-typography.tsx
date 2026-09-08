"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Play, Sparkles, Activity, ShieldCheck, CheckCircle2 } from "lucide-react";

interface HeroTypographyProps {
  onOpenDemo?: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
};

export function HeroTypography({ onOpenDemo }: HeroTypographyProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col justify-center max-w-2xl relative"
    >
      {/* Top Track & Competition Badge */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.12] backdrop-blur-xl shadow-lg shadow-emerald-950/20 group hover:border-emerald-500/40 transition-colors">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="font-mono text-xs font-medium text-zinc-300 tracking-wider">
            SOKRATES × BINUS 2026
          </span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-xs font-semibold text-emerald-400 tracking-wider">
            INTELLIGENCE MANUFACTURING
          </span>
        </div>
      </motion.div>

      {/* Dominant Headline with Clash Display (Geometric, Bold, Punchy) */}
      <motion.div variants={itemVariants}>
        <h1 className="font-display text-4xl sm:text-6xl lg:text-[68px] font-bold tracking-tight text-white leading-[1.12] mb-6">
          Sistem Otonom <br />
          <span className="text-zinc-200">Deteksi Cacat &amp;</span> <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Aksi Nyata Pabrik
          </span>
        </h1>
      </motion.div>

      {/* Subheadline: General Sans font for crisp, human, high-end editorial feel */}
      <motion.div variants={itemVariants}>
        <p className="font-sans text-base sm:text-lg text-zinc-300/90 font-normal leading-relaxed mb-8 max-w-xl text-balance">
          Bukan sekadar dashboard QC visual yang pasif. SIGAP menghubungkan deteksi computer
          vision di lini konveyor pengecoran logam langsung ke eksekusi sistem ERP bisnis{" "}
          <span className="text-white font-medium underline decoration-emerald-400/60 decoration-1 underline-offset-4">
            SAP QM, MM, dan PP
          </span>{" "}
          secara otonom dalam milidetik.
        </p>
      </motion.div>

      {/* Action Buttons with sexy spring and magnetic hover micro-animations */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 mb-12">
        <motion.button
          whileHover={{ scale: 1.025, y: -1 }}
          whileTap={{ scale: 0.975 }}
          onClick={onOpenDemo}
          className="group relative inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-sans font-bold text-sm tracking-wide shadow-xl shadow-emerald-500/25 hover:shadow-emerald-400/40 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          {/* Subtle button light shimmer on hover */}
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          <Sparkles className="w-4 h-4 text-zinc-950 relative z-10" />
          <span className="relative z-10">Coba Live Demo</span>
          <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform duration-200" />
        </motion.button>

        <motion.a
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          href="#loop"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 hover:text-white font-sans font-medium text-sm border border-white/[0.12] hover:border-white/[0.22] backdrop-blur-xl shadow-lg transition-all duration-200"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span>Lihat 5-Step Loop</span>
        </motion.a>
      </motion.div>

      {/* Bottom-Left Trust / Telemetry Metrics Proof */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-4 pt-5 border-t border-white/[0.08]"
      >
        {/* Avatars with enterprise glow */}
        <div className="flex -space-x-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#050505] bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-xs font-mono font-bold text-zinc-950 shadow-md">
            QC
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-[#050505] bg-gradient-to-tr from-cyan-600 to-blue-400 flex items-center justify-center text-xs font-mono font-bold text-zinc-950 shadow-md">
            AI
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-[#050505] bg-zinc-800 flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400 shadow-md">
            SAP
          </div>
        </div>

        {/* Metric info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-white tracking-normal">
              99.4% Akurasi Deteksi
            </span>
            <span className="text-zinc-600">•</span>
            <span className="font-mono text-xs text-emerald-400 font-medium">
              &lt;100ms YOLOv8
            </span>
          </div>
          <p className="font-sans text-xs text-zinc-400 mt-0.5">
            Teruji pada 4 kelas cacat baja &amp; pengecoran otomotif SME
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}


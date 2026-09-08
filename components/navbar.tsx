"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, X, Radio, Sparkles } from "lucide-react";

interface NavbarProps {
  onOpenDemo?: () => void;
}

export function Navbar({ onOpenDemo }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Solusi", href: "#solusi" },
    { label: "Arsitektur Loop", href: "#loop" },
    { label: "SAP Mock Hub", href: "#sap" },
    { label: "Audit Trail", href: "#sejarah" },
  ];

  return (
    <motion.header
      initial={{ y: -25, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-3.5 sm:top-5 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none"
    >
      <div className="w-full max-w-5xl lg:max-w-6xl pointer-events-auto flex flex-col items-center">
        {/* Main Floating Rounded-Full Pill Bar */}
        <div
          className={`w-full rounded-full transition-all duration-300 flex items-center justify-between border ${
            scrolled
              ? "bg-[#06080d]/90 backdrop-blur-2xl border-white/[0.14] py-2 sm:py-2.5 px-4 sm:px-6 shadow-2xl shadow-black/80"
              : "bg-[#080b11]/75 backdrop-blur-xl border-white/10 hover:border-emerald-500/30 py-2.5 sm:py-3 px-5 sm:px-7 shadow-xl shadow-black/60"
          }`}
        >
          {/* Left: Brand Logo & Wordmark (Inline inside pill) */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1px] shadow-md shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              <div className="w-full h-full bg-[#090b10] rounded-[11px] flex items-center justify-center overflow-hidden">
                <Image
                  src="/image/image.png"
                  alt="SIGAP Mascot"
                  width={36}
                  height={36}
                  priority
                  className="w-full h-full object-cover object-center group-hover:scale-115 transition-transform duration-300"
                />
              </div>
              {/* Pulsing online pip */}
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                SIGAP
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hidden xs:inline-flex">
                Agentic AI
              </span>
            </div>
          </Link>

          {/* Center: Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs sm:text-sm font-sans font-medium text-zinc-300">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-white transition-colors py-1 relative group"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-emerald-400 rounded-full transition-all duration-200 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* Right: Primary Solid Pill Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Primary Solid Pill Button */}
            <button
              onClick={onOpenDemo}
              className="group relative flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-sans font-bold text-xs tracking-wide shadow-md hover:shadow-emerald-400/25 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <span>Demo Supervisor</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Mobile Hamburger Toggle Button (Preserves Pill Shape on Mobile) */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Navigation Menu"
              className="md:hidden p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Sheet (Floats right underneath the pill) */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full mt-2 p-4 rounded-3xl bg-[#080b11]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/90 flex flex-col gap-3 md:hidden"
            >
              <div className="flex items-center justify-between px-2 pb-2 border-b border-white/[0.08]">
                <span className="font-mono text-[10px] text-zinc-400">
                  Sistem Otonom SIGAP
                </span>
                <span className="font-mono text-[10px] text-emerald-400">
                  v1.0.4-sme
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-2xl text-sm font-sans font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDemo?.();
                }}
                className="w-full mt-1 flex items-center justify-center gap-2 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-sans font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mulai Simulasi Demo QC</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

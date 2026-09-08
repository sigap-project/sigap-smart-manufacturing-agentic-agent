"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero/hero-section";
import { ProblemSection } from "@/components/sections/problem-section";
import { LoopSection } from "@/components/sections/loop-section";
import { SapArchitectureSection } from "@/components/sections/sap-architecture-section";
import { FooterSection } from "@/components/sections/footer-section";
import { DemoModal } from "@/components/modals/demo-modal";

export default function HomePage() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#050505] text-white relative">
      {/* Top Glassmorphic Navigation */}
      <Navbar onOpenDemo={() => setIsDemoOpen(true)} />

      {/* Hero Section (Replicating TheDomeHome aesthetic with Stacked Typography & Floating Telemetry Card) */}
      <HeroSection onOpenDemo={() => setIsDemoOpen(true)} />

      {/* Section 2: Problem & Agitation in SME Manufacturing */}
      <ProblemSection />

      {/* Section 3: 5-Step Autonomous Closed Loop */}
      <LoopSection />

      {/* Section 4: SAP Mock & AWS Bedrock Architecture */}
      <SapArchitectureSection />

      {/* Footer Section */}
      <FooterSection onOpenDemo={() => setIsDemoOpen(true)} />

      {/* Interactive Simulation Modal for Judges & Demo Day */}
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </main>
  );
}

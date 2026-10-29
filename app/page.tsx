"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero/hero-section";
import { ProblemSection } from "@/components/sections/problem-section";
import { LoopSection } from "@/components/sections/loop-section";
import { SapArchitectureSection } from "@/components/sections/sap-architecture-section";
import { FooterSection } from "@/components/sections/footer-section";

export default function HomePage() {
  const router = useRouter();

  // Demo buttons sign the visitor in as supervisor first; if that is disabled or fails,
  // the dashboard's inline sign-in banners still work.
  const handleOpenDashboard = async () => {
    await fetch("/api/auth/demo", { method: "POST" }).catch(() => {});
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white relative">
      {/* Top Glassmorphic Navigation */}
      <Navbar onOpenDemo={handleOpenDashboard} />

      {/* Hero Section (Replicating TheDomeHome aesthetic with Stacked Typography & Floating Telemetry Card) */}
      <HeroSection onOpenDemo={handleOpenDashboard} />

      {/* Section 2: Problem & Agitation in SME Manufacturing */}
      <ProblemSection />

      {/* Section 3: 5-Step Autonomous Closed Loop */}
      <LoopSection />

      {/* Section 4: SAP Mock & AWS Bedrock Architecture */}
      <SapArchitectureSection />

      {/* Footer Section */}
      <FooterSection onOpenDemo={handleOpenDashboard} />
    </main>
  );
}

"use client";

import { ScrollScrubSection, ScrollScrubStep } from "@/components/ui/scroll-scrub-section";

export function LoopSection() {
  const steps: ScrollScrubStep[] = [
    {
      id: "scan",
      rangeStart: 0.0,
      rangeEnd: 0.2,
      title: "01. SCAN",
      description:
        "Kamera optik high-speed memindai permukaan komponen logam di atas konveyor dalam latensi di bawah 100 milidetik.",
    },
    {
      id: "reasoning",
      rangeStart: 0.2,
      rangeEnd: 0.4,
      title: "02. REASONING",
      description:
        "AWS Bedrock Agent menganalisis pola anomali berulang dan menghitung skor eskalasi ke sistem bisnis secara otonom.",
    },
    {
      id: "store",
      rangeStart: 0.4,
      rangeEnd: 0.6,
      title: "03. STORE",
      description:
        "Komponen bermasalah otomatis dialokasikan ke zona karantina fisik dan logis untuk mencegah kontaminasi produk OK.",
    },
    {
      id: "dispatch",
      rangeStart: 0.6,
      rangeEnd: 0.8,
      title: "04. DISPATCH",
      description:
        "Agen mengeksekusi mutasi data bisnis ke SAP QM, menandai supplier di SAP MM, dan mereschedule produksi di SAP PP.",
    },
    {
      id: "history",
      rangeStart: 0.8,
      rangeEnd: 1.0,
      title: "05. HISTORY",
      description:
        "Seluruh rantai keputusan tercatat transparan sebagai audit trail serta feedback loop kalibrasi formula eskalasi.",
    },
  ];

  return (
    <section id="loop" className="relative bg-[#050505]">
      {/* Full-Bleed Scroll-Scrubbed Image-Sequence Section with 294 Frames */}
      <ScrollScrubSection
        eyebrow="ARSITEKTUR OTONOM END-TO-END"
        heading="The 5-Step Autonomous Loop"
        framePathPattern="/animation/ezgif-frame-{n}.jpg"
        frameCount={294}
        padLength={3}
        steps={steps}
        scrollHeightMultiplier={5}
      />
    </section>
  );
}

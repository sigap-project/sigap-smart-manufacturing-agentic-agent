"use client";

import { AnimatePresence } from "framer-motion";
import { Camera, Cpu, CheckCircle2, ShieldAlert } from "lucide-react";
import { TwinFloatingBadge } from "./twin-floating-badge";

interface TwinOverlayBadgesProps {
  showBadges: boolean;
  systemState: "idle" | "scanning" | "ok" | "defect";
  stats?: {
    totalInspections?: number;
    batchesHeldCount?: number;
    heldDefectPcs?: number;
    defectRate?: number;
  };
}

export function TwinOverlayBadges({
  showBadges,
  systemState,
  stats,
}: TwinOverlayBadgesProps) {
  if (!showBadges) return null;

  const totalInspectionsText = `${(stats?.totalInspections ?? 1428).toLocaleString("en-US")} Pcs`;
  const heldLotsText = `${stats?.batchesHeldCount ?? 3} Lots`;
  const anomalyPcsText = `${stats?.heldDefectPcs ?? 36} pcs anomalies`;

  const badges = [
    {
      id: "badge-optical-scanner",
      position: "top-[20%] left-[28%]",
      icon: Camera,
      title: "YOLOv8-Nano",
      tagText: "6.0ms",
      tagVariant: "accent" as const,
      valueText: "99.72%",
      subtitle: "Detection Accuracy",
      isActive: systemState === "scanning",
      activeTone: "accent" as const,
      delay: 0,
    },
    {
      id: "badge-ai-sap-station",
      position: "bottom-[42%] left-[12%]",
      icon: Cpu,
      title: "AWS Bedrock AI",
      tagText: "SAP QM",
      tagVariant: "neutral" as const,
      valueText: "Autonomous",
      subtitle: "ERP Mutation Active",
      isActive: systemState === "idle",
      activeTone: "accent" as const,
      delay: 0.05,
    },
    {
      id: "badge-release-ok",
      position: "top-[22%] right-[18%]",
      icon: CheckCircle2,
      title: "Release OK",
      tagText: "QC Passed",
      tagVariant: "success" as const,
      valueText: totalInspectionsText,
      subtitle: "Defect-Free",
      isActive: systemState === "ok",
      activeTone: "success" as const,
      delay: 0.1,
    },
    {
      id: "badge-quarantine-defect",
      position: "bottom-[28%] right-[16%]",
      icon: ShieldAlert,
      title: "Defect Quarantine",
      tagText: heldLotsText,
      tagVariant: "danger" as const,
      valueText: anomalyPcsText,
      subtitle: "Pending Review",
      isActive: systemState === "defect",
      activeTone: "danger" as const,
      delay: 0.15,
    },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <AnimatePresence>
        {badges.map((badge) => (
          <TwinFloatingBadge key={badge.id} {...badge} />
        ))}
      </AnimatePresence>
    </div>
  );
}

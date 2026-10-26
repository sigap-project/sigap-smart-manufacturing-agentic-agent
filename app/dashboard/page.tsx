import { Metadata } from "next";
import { sigapStore } from "@/lib/store";
import { TwinCommandCenter } from "@/components/dashboard/twin/twin-command-center";

export const metadata: Metadata = {
  title: "Command Center Kualitas 3D — SIGAP Agentic AI",
  description:
    "Pusat Pemantauan Digital Twin 3D Cacat Komponen Logam, Penalaran Agentic AI AWS Bedrock, dan Mutasi Otonom SAP QM/MM/PP.",
};

export default async function DashboardPage() {
  const stats = await sigapStore.getDashboardStats();

  return <TwinCommandCenter stats={stats} />;
}
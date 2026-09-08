"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-100 flex flex-col md:flex-row antialiased">
      {/* Fixed Sidebar for Desktop + Drawer for Mobile */}
      <DashboardSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Right Side Area: Topbar + Scrollable Content */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Topbar persistent across all dashboard pages */}
        <DashboardTopbar
          plantName="PT Logam Presisi Nusantara"
          lineName="Line #02 • High-Pressure Die Casting"
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Dynamic Scrollable Content Page Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

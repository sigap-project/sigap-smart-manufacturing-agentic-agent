"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { SigapGlobalProvider } from "@/context/sigap-global-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <SigapGlobalProvider>
      <div className="min-h-screen bg-[#F8F9FB] text-slate-800 flex flex-col md:flex-row antialiased">
      {/* Fixed Sidebar for Desktop + Drawer for Mobile */}
      <DashboardSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Right Side Area: Topbar + Scrollable Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0 min-h-screen relative bg-[#F8F9FB]">
        {/* Topbar persistent across all dashboard pages */}
        <DashboardTopbar
          plantName="PT Logam Presisi Nusantara"
          lineName="Line #02 • High-Pressure Die Casting"
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Dynamic Scrollable Content Page Area */}
        <main
          className={
            isDashboard
              ? "flex-1 p-0 overflow-y-auto relative bg-[#F8F9FB] text-slate-900"
              : "flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#F8F9FB] text-slate-800"
          }
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </SigapGlobalProvider>
  );
}

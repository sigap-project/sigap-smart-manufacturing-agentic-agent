import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>

      {/* Row 2: Defect Chart (7 cols) + Live Camera Monitor (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Skeleton className="h-[390px] rounded-3xl" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-[390px] rounded-3xl" />
        </div>
      </div>

      {/* Row 3: Recent Activity (6 cols) + Priority Items (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
        <div className="lg:col-span-6">
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

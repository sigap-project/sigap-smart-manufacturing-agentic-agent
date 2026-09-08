import { Skeleton } from "@/components/ui/skeleton";

export function DispatchSkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-80 rounded-xl" />
            <Skeleton className="h-6 w-44 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <Skeleton className="h-16 rounded-2xl" />

      {/* Table Container Skeleton */}
      <div className="rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl space-y-4">
        {/* Table Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <Skeleton className="h-5 w-48 rounded-lg" />
          <Skeleton className="h-5 w-24 rounded-lg" />
        </div>

        {/* 6 Table Rows */}
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

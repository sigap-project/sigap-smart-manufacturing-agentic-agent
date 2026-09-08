import { Skeleton } from "@/components/ui/skeleton";

export function HistorySkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-xl" />
            <Skeleton className="h-6 w-44 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filter Bar */}
      <Skeleton className="h-16 rounded-2xl" />

      {/* Table Container Skeleton */}
      <div className="rounded-3xl p-5 sm:p-6 bg-[#0b0e14]/80 backdrop-blur-md border border-white/[0.08] shadow-xl space-y-4">
        {/* Table Column Headers */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <Skeleton className="h-5 w-56 rounded-lg" />
          <Skeleton className="h-5 w-32 rounded-lg" />
        </div>

        {/* 6 Inspection Rows */}
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

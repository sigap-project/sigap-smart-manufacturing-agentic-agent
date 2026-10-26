import { Skeleton } from "@/components/ui/skeleton";

export function DispatchSkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-80 rounded-xl bg-slate-200/80" />
            <Skeleton className="h-6 w-36 rounded-full bg-slate-200/80" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg bg-slate-200/60" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-44 rounded-xl bg-slate-200/80" />
          <Skeleton className="h-9 w-32 rounded-xl bg-slate-200/80" />
        </div>
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Skeleton className="h-4 w-28 rounded mb-3 bg-slate-200/80" />
            <Skeleton className="h-8 w-20 rounded bg-slate-200/80" />
          </div>
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <Skeleton className="h-16 rounded-2xl bg-white border border-slate-200/80" />

      {/* Table Container Skeleton */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        {/* Table Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <Skeleton className="h-5 w-48 rounded-lg bg-slate-200/80" />
          <Skeleton className="h-5 w-24 rounded-lg bg-slate-200/80" />
        </div>

        {/* 6 Table Rows */}
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl bg-slate-100/70" />
          ))}
        </div>
      </div>
    </div>
  );
}

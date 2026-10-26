import { Skeleton } from "@/components/ui/skeleton";

export function HistorySkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-xl bg-slate-200/80" />
            <Skeleton className="h-6 w-36 rounded-full bg-slate-200/80" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg bg-slate-200/60" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl bg-slate-200/80" />
      </div>

      {/* Filter Bar */}
      <Skeleton className="h-16 rounded-2xl bg-white border border-slate-200/80" />

      {/* Table Container Skeleton */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        {/* Table Column Headers */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <Skeleton className="h-5 w-56 rounded-lg bg-slate-200/80" />
          <Skeleton className="h-5 w-32 rounded-lg bg-slate-200/80" />
        </div>

        {/* 6 Inspection Rows */}
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl bg-slate-100/70" />
          ))}
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Skeleton className="h-5 w-36 rounded-lg bg-slate-200/80" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg bg-slate-200/80" />
            <Skeleton className="h-8 w-8 rounded-lg bg-slate-200/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

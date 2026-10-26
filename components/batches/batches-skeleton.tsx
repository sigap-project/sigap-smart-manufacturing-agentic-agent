import { Skeleton } from "@/components/ui/skeleton";

export function BatchesSkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-80 rounded-xl bg-slate-200/80" />
            <Skeleton className="h-6 w-36 rounded-full bg-slate-200/80" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg bg-slate-200/80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-xl bg-slate-200/80" />
          <Skeleton className="h-9 w-32 rounded-xl bg-slate-200/80" />
        </div>
      </div>

      {/* Row 1: 5 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-slate-200/80" />
        ))}
      </div>

      {/* Filter Bar */}
      <Skeleton className="h-16 rounded-2xl bg-slate-200/80" />

      {/* Main Grid: 8 cols (Batch Grid) + 4 cols (Approval Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl bg-slate-200/80" />
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <Skeleton className="h-[600px] rounded-2xl bg-slate-200/80" />
        </div>
      </div>
    </div>
  );
}

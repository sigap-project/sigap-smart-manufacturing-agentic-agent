import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-16 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-xl bg-slate-200/80" />
            <Skeleton className="h-6 w-36 rounded-full bg-slate-200/80" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg bg-slate-200/60" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-36 rounded-xl bg-slate-200/80" />
          <Skeleton className="h-8 w-44 rounded-xl bg-slate-200/80" />
        </div>
      </div>

      {/* 4 Stacked Form Card Skeletons */}
      <div className="h-56 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
        <Skeleton className="h-5 w-48 rounded bg-slate-200/80" />
        <Skeleton className="h-16 rounded-xl bg-slate-100" />
        <Skeleton className="h-16 rounded-xl bg-slate-100" />
      </div>

      <div className="h-72 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
        <Skeleton className="h-5 w-56 rounded bg-slate-200/80" />
        <Skeleton className="h-20 rounded-xl bg-slate-100" />
        <Skeleton className="h-20 rounded-xl bg-slate-100" />
      </div>

      <div className="h-64 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
        <Skeleton className="h-5 w-52 rounded bg-slate-200/80" />
        <Skeleton className="h-24 rounded-xl bg-slate-100" />
        <Skeleton className="h-14 rounded-xl bg-slate-100" />
      </div>

      <div className="h-52 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
        <Skeleton className="h-5 w-44 rounded bg-slate-200/80" />
        <Skeleton className="h-14 rounded-xl bg-slate-100" />
        <Skeleton className="h-14 rounded-xl bg-slate-100" />
      </div>

      {/* Action Bar Skeleton */}
      <div className="flex items-center justify-between pt-4">
        <Skeleton className="h-10 w-32 rounded-xl bg-slate-200/80" />
        <Skeleton className="h-10 w-44 rounded-xl bg-slate-200/80" />
      </div>
    </div>
  );
}

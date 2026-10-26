import { Skeleton } from "@/components/ui/skeleton";

export function InspectionSkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-xl bg-slate-200/80" />
            <Skeleton className="h-6 w-36 rounded-full bg-slate-200/80" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg bg-slate-200/80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-xl bg-slate-200/80" />
          <Skeleton className="h-9 w-44 rounded-xl bg-slate-200/80" />
        </div>
      </div>

      {/* Two-Column Split Layout: 7 cols Left, 5 cols Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Camera Viewport */}
        <div className="lg:col-span-7 xl:col-span-7">
          <Skeleton className="h-[640px] rounded-2xl bg-slate-200/80" />
        </div>

        {/* Right Column (5 cols): Events List + Reasoning Trace + Gauge */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6">
          <Skeleton className="h-[270px] rounded-2xl bg-slate-200/80" />
          <Skeleton className="h-[310px] rounded-2xl bg-slate-200/80" />
          <Skeleton className="h-[120px] rounded-2xl bg-slate-200/80" />
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-16 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-xl" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-8 w-44 rounded-xl" />
        </div>
      </div>

      {/* 4 Stacked Form Cards matching HardwareConfigCard, ModelAiConfigCard, AgentAutonomyCard, ExportLogCard */}
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-80 rounded-3xl" />
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-60 rounded-3xl" />

      {/* Action Bar Skeleton */}
      <div className="flex items-center justify-between pt-4">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

const spinnerSizes = {
  sm: "h-4 w-4 border-2",
  md: "h-7 w-7 border-[3px]",
  lg: "h-10 w-10 border-4",
} as const;

export function Spinner({ size = "md", className = "" }: { size?: keyof typeof spinnerSizes; className?: string }) {
  return (
    <span role="status" aria-label="Loading" className={`inline-block animate-spin rounded-full border-current border-t-transparent ${spinnerSizes[size]} ${className}`} />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <section className="px-5 py-8" aria-busy="true" aria-label={label}>
      <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <Spinner size="md" className="shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
        </div>
        <Skeleton className="mt-5 h-20 w-full" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <section className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]" aria-busy="true" aria-label="Loading portfolio">
      <div className="rounded-[28px] bg-blue-700 p-5 shadow-xl shadow-blue-900/20">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32 bg-blue-500/70" />
            <Skeleton className="h-7 w-40 bg-blue-500/70" />
          </div>
          <Skeleton className="h-10 w-10 rounded-2xl bg-blue-500/70" />
        </div>
        <Skeleton className="mt-8 h-11 w-48 bg-blue-500/70" />
        <Skeleton className="mt-3 h-3 w-64 max-w-full bg-blue-500/70" />
      </div>
      <div className="mt-5 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-3 py-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="ml-auto h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LoadingButtonContent({ loading, loadingLabel, children }: { loading: boolean; loadingLabel: string; children: ReactNode }) {
  if (!loading) return children;
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner size="sm" />
      <span>{loadingLabel}</span>
    </span>
  );
}

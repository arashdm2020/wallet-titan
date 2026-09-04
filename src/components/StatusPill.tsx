import type { ActivityStatus } from "@/domain/wallet";

const statusClass: Record<ActivityStatus, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  failed: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
};

export function StatusPill({ status }: { status: ActivityStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[status]}`}>{status}</span>;
}

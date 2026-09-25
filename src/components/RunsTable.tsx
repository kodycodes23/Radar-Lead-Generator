"use client";

import Link from "next/link";
import { useRunsPolling } from "@/lib/useRunsPolling";
import type { Run } from "@/lib/types";

export function RunsTable({ initialRuns }: { initialRuns: Run[] }) {
  const runs = useRunsPolling(initialRuns);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-panel-border bg-panel">
      {runs.length === 0 ? (
        <EmptyState />
      ) : (
        <table className="min-w-full divide-y divide-panel-border text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Objective</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Qualified</th>
              <th className="px-4 py-3">Needs review</th>
              <th className="px-4 py-3">Apify cost</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border">
            {runs.map((run) => (
              <tr key={run.id} className="transition hover:bg-neutral-900/60">
                <td className="max-w-xs truncate px-4 py-3">
                  <Link href={`/runs/${run.id}`} className="text-neutral-100 hover:text-accent">
                    {run.objective}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {run.qualified_count}/{run.lead_count_target}
                </td>
                <td className="px-4 py-3 text-neutral-300">{run.needs_review_count}</td>
                <td className="px-4 py-3 text-neutral-300">
                  ${Number(run.estimated_apify_cost_usd).toFixed(3)}
                </td>
                <td className="px-4 py-3 text-neutral-500">{new Date(run.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-neutral-500">
        &#128193;
      </div>
      <p className="font-medium text-neutral-200">No runs yet</p>
      <p className="text-sm text-neutral-500">Runs you start will appear here.</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
      >
        + Start a run
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "failed"
        ? "bg-red-400/15 text-red-300"
        : "bg-amber-400/15 text-amber-300";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status !== "completed" && status !== "failed" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {status}
    </span>
  );
}

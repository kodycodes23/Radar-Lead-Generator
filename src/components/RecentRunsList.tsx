"use client";

import Link from "next/link";
import { useRunsPolling } from "@/lib/useRunsPolling";
import type { Run } from "@/lib/types";

const STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-400",
  failed: "bg-red-400",
};

export function RecentRunsList({ initialRuns }: { initialRuns: Run[] }) {
  const runs = useRunsPolling(initialRuns, 8);

  return (
    <ul className="mt-2 space-y-0.5">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            href={`/runs/${run.id}`}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? "bg-amber-400 animate-pulse"}`} />
            <span className="truncate">{run.objective}</span>
          </Link>
        </li>
      ))}
      {runs.length === 0 && <li className="px-3 py-2 text-xs text-neutral-600">No runs yet.</li>}
    </ul>
  );
}

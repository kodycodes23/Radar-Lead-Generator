import Link from "next/link";
import { listRuns } from "@/lib/db";
import { RecentRunsList } from "./RecentRunsList";
import { ErrorLogNavLink } from "./ErrorLogNavLink";

export async function Sidebar() {
  const recentRuns = await listRuns(8).catch(() => []);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-panel-border bg-panel">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-neutral-950">
          R
        </div>
        <span className="text-sm font-semibold tracking-tight text-neutral-100">Radar</span>
      </div>

      <div className="px-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-panel-border bg-neutral-900/60 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-accent/40 hover:bg-neutral-900"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-800 text-xs">+</span>
          New run
        </Link>
      </div>

      <nav className="mt-4 px-3">
        <Link
          href="/runs"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100"
        >
          <span aria-hidden>&#9776;</span>
          All runs
        </Link>
        <ErrorLogNavLink />
      </nav>

      <div className="mt-6 flex-1 overflow-y-auto px-3">
        <p className="px-3 text-xs font-medium uppercase tracking-wide text-neutral-600">Recent</p>
        <RecentRunsList initialRuns={recentRuns} />
      </div>

      <div className="border-t border-panel-border px-5 py-4 text-xs text-neutral-600">
        Research &amp; drafts only -- nothing is ever sent.
      </div>
    </aside>
  );
}

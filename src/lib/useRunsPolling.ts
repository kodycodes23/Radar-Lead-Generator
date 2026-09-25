"use client";

import { useEffect, useState } from "react";
import { ACTIVE_RUN_STATUSES, type Run } from "./types";

// While idle, still poll on a slow heartbeat rather than stopping entirely.
// This list's owner (e.g. the sidebar, in the root layout) is typically
// mounted once per browser session, not re-fetched on every client-side
// navigation -- if it goes idle before a brand-new run is even created
// elsewhere, it has no signal to notice that run until this heartbeat picks
// it up. Real evidence: a run started from a fully-idle sidebar never
// appeared in "Recent" (wrong order/missing) until a hard page reload.
const IDLE_POLL_MS = 15000;

/**
 * Keeps a run list fresh by polling GET /api/runs -- every 2s while any run
 * in the current list is active, every IDLE_POLL_MS otherwise so a run
 * created elsewhere still surfaces without a full page reload.
 */
export function useRunsPolling(initialRuns: Run[], limit?: number): Run[] {
  const [runs, setRuns] = useState(initialRuns);

  const isActive = runs.some((r) => ACTIVE_RUN_STATUSES.includes(r.status));

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch(`/api/runs${limit ? `?limit=${limit}` : ""}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setRuns(data.runs);
      } catch {
        // transient fetch failure -- next poll attempt will retry
      }
    }

    const interval = setInterval(refresh, isActive ? 2000 : IDLE_POLL_MS);
    return () => clearInterval(interval);
  }, [isActive, limit]);

  return runs;
}

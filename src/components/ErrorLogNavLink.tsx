"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Per-viewer "have I looked at this" convenience -- no user accounts exist
// in this single-user internal tool, so localStorage (not a DB column) is
// the right place for it, same reasoning as every other browser-storage use
// in this app.
const STORAGE_KEY = "radar_errors_last_seen";
const POLL_MS = 20_000;

function getLastSeen(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

export function ErrorLogNavLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/errors/count?since=${encodeURIComponent(getLastSeen())}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setCount(data.count ?? 0);
      } catch {
        // transient fetch failure -- next poll retries
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function handleClick() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // private window / blocked storage -- badge just won't clear, not fatal
    }
    setCount(0);
  }

  return (
    <Link
      href="/errors"
      onClick={handleClick}
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden>&#9888;</span>
        Error log
      </span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

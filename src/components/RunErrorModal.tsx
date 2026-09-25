"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Run } from "@/lib/types";

export function RunErrorModal({
  run,
  tone,
  onClose,
}: {
  run: Run;
  tone: "error" | "warn";
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isError = tone === "error";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-12"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl overflow-hidden rounded-2xl border bg-panel shadow-2xl ${
          isError ? "border-red-500/40" : "border-amber-500/40"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center gap-2 border-b px-8 py-4 text-sm font-medium ${
            isError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          <span aria-hidden>&#9888;</span> {isError ? "This run failed" : "Completed short of the qualified-leads target"}
        </div>

        <div className="px-8 pb-6 pt-8">
          <p className="text-base text-neutral-100">{run.objective}</p>
          <p className="mt-1.5 text-sm text-neutral-500">{new Date(run.created_at).toLocaleString()}</p>
        </div>

        <div className="space-y-6 border-t border-panel-border px-8 py-6">
          {/* The one line most people should actually read. */}
          <p
            className={`rounded-xl border p-4 text-base font-medium leading-relaxed ${
              isError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            {run.error_summary ?? run.error_message}
          </p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Progress at this point</p>
            <p className="mt-2 text-sm text-neutral-300">
              {run.qualified_count}/{run.lead_count_target} qualified -- {run.companies_discovered_count} discovered,{" "}
              {run.websites_scraped_count} scraped
            </p>
          </div>

          {/* Only shown when there's more to it than the summary above -- the
              full explanation, for whoever actually wants to read it. */}
          {run.error_summary && run.error_message && run.error_message !== run.error_summary && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Full explanation</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{run.error_message}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-panel-border px-8 py-5">
          <Link
            href={`/runs/${run.id}`}
            className="rounded-full border border-panel-border px-5 py-2 text-sm font-medium text-neutral-300 transition hover:text-neutral-100"
          >
            Open run
          </Link>
          <button
            onClick={onClose}
            className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

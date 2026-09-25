"use client";

import { useState } from "react";
import type { Run, ToolCall } from "@/lib/types";
import type { ErrorToolCallEntry } from "@/lib/db";
import { truncate } from "@/lib/text";
import { RunErrorModal } from "./RunErrorModal";
import { ToolCallDetail } from "./ToolCallDetail";

export function ErrorLogView({
  failedRuns,
  shortfallRuns,
  errorToolCalls,
}: {
  failedRuns: Run[];
  shortfallRuns: Run[];
  errorToolCalls: ErrorToolCallEntry[];
}) {
  const [selectedRun, setSelectedRun] = useState<{ run: Run; tone: "error" | "warn" } | null>(null);
  const [selectedToolCall, setSelectedToolCall] = useState<ToolCall | null>(null);

  return (
    <>
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-200">Failed runs ({failedRuns.length})</h2>
        {failedRuns.length === 0 ? (
          <EmptyState text="No failed runs." />
        ) : (
          <div className="mt-3 divide-y divide-panel-border overflow-hidden rounded-2xl border border-panel-border bg-panel">
            {failedRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRun({ run, tone: "error" })}
                className="block w-full px-4 py-3 text-left transition hover:bg-neutral-900/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-neutral-100">{run.objective}</p>
                  <span className="whitespace-nowrap text-xs text-neutral-500">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-red-300">
                  {run.error_summary ?? truncate(run.error_message ?? "", 140)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-200">Completed short of target ({shortfallRuns.length})</h2>
        {shortfallRuns.length === 0 ? (
          <EmptyState text="No completed runs finished under their qualified-leads target." />
        ) : (
          <div className="mt-3 divide-y divide-panel-border overflow-hidden rounded-2xl border border-panel-border bg-panel">
            {shortfallRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRun({ run, tone: "warn" })}
                className="block w-full px-4 py-3 text-left transition hover:bg-neutral-900/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-neutral-100">{run.objective}</p>
                  <span className="whitespace-nowrap text-xs text-neutral-500">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-amber-300">
                  {run.qualified_count}/{run.lead_count_target} qualified --{" "}
                  {run.error_summary ?? truncate(run.error_message ?? "", 100)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-200">Tool-call errors ({errorToolCalls.length})</h2>
        {errorToolCalls.length === 0 ? (
          <EmptyState text="No tool-call errors." />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-panel-border bg-panel">
            <table className="min-w-full divide-y divide-panel-border text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Tool</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {errorToolCalls.map((tc) => (
                  <tr
                    key={tc.id}
                    onClick={() => setSelectedToolCall(tc)}
                    className="cursor-pointer transition hover:bg-neutral-900/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {new Date(tc.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-neutral-300">{tc.run_objective}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-300">{tc.tool_name}</td>
                    <td className="max-w-md truncate px-4 py-3 text-red-300">{truncate(tc.error_message ?? "", 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRun && (
        <RunErrorModal run={selectedRun.run} tone={selectedRun.tone} onClose={() => setSelectedRun(null)} />
      )}
      {selectedToolCall && <ToolCallDetail toolCall={selectedToolCall} onClose={() => setSelectedToolCall(null)} />}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-2xl border border-panel-border bg-panel px-4 py-8 text-center text-sm text-neutral-500">
      {text}
    </p>
  );
}

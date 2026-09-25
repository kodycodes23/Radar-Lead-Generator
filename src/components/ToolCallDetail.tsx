"use client";

import { useEffect } from "react";
import type { ToolCall } from "@/lib/types";

function prettyPrint(raw: string | null): string {
  if (!raw) return "--";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function ToolCallDetail({ toolCall, onClose }: { toolCall: ToolCall; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isError = toolCall.status === "error";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-12"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl overflow-hidden rounded-2xl border bg-panel shadow-2xl ${
          isError ? "border-red-500/40" : "border-panel-border"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isError && (
          <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-8 py-4 text-sm font-medium text-red-300">
            <span aria-hidden>&#9888;</span> This tool call failed
          </div>
        )}

        <div className="flex items-start justify-between gap-4 px-8 pb-6 pt-8">
          <div>
            <p className="font-mono text-base text-neutral-100">{toolCall.tool_name}</p>
            <p className="mt-1.5 text-sm text-neutral-500">
              {new Date(toolCall.created_at).toLocaleString()}
              {toolCall.duration_ms !== null && <span className="mx-1.5 text-neutral-700">&middot;</span>}
              {toolCall.duration_ms !== null && `${toolCall.duration_ms}ms`}
              {toolCall.cost_usd ? <span className="mx-1.5 text-neutral-700">&middot;</span> : null}
              {toolCall.cost_usd ? `$${Number(toolCall.cost_usd).toFixed(4)}` : null}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              isError ? "bg-red-400/15 text-red-300" : "bg-emerald-400/15 text-emerald-300"
            }`}
          >
            {toolCall.status}
          </span>
        </div>

        <div className="space-y-6 border-t border-panel-border px-8 py-6">
          <DetailSection label="What was called, and why">
            <p className="text-sm leading-relaxed text-neutral-300">{toolCall.purpose ?? "--"}</p>
          </DetailSection>

          <DetailSection label="Input">
            <pre className="max-h-56 overflow-auto rounded-xl border border-panel-border bg-neutral-950/80 p-4 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-neutral-400">
              {prettyPrint(toolCall.input_summary)}
            </pre>
          </DetailSection>

          {isError ? (
            <DetailSection label="Error" tone="error">
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300">
                {toolCall.error_message}
              </p>
            </DetailSection>
          ) : (
            <DetailSection label="Result">
              <p className="text-sm leading-relaxed text-neutral-300">{toolCall.result_summary ?? "--"}</p>
            </DetailSection>
          )}

          {toolCall.lead_id && (
            <DetailSection label="Related lead">
              <p className="font-mono text-xs text-neutral-500">{toolCall.lead_id}</p>
            </DetailSection>
          )}
        </div>

        <div className="flex justify-end border-t border-panel-border px-8 py-5">
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

function DetailSection({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "error";
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          tone === "error" ? "text-red-400" : "text-neutral-500"
        }`}
      >
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

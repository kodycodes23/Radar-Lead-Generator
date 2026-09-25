"use client";

import { useEffect } from "react";
import type { OutreachEdit, OutreachEditValue } from "@/lib/types";

const FIELD_LABELS: Record<OutreachEdit["field"], string> = {
  email_1: "Email 1",
  email_2: "Email 2",
  email_3: "Email 3",
  linkedin: "LinkedIn message",
};

export function OutreachEditDetail({
  edit,
  leadName,
  onClose,
}: {
  edit: OutreachEdit;
  leadName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-panel-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-8 pb-6 pt-8">
          <div>
            <p className="text-base text-neutral-100">
              {leadName} <span className="text-neutral-600">&middot;</span> {FIELD_LABELS[edit.field]}
            </p>
            <p className="mt-1.5 text-sm text-neutral-500">{new Date(edit.created_at).toLocaleString()}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              edit.source === "manual" ? "bg-sky-400/15 text-sky-300" : "bg-violet-400/15 text-violet-300"
            }`}
          >
            {edit.source === "manual" ? "Manually edited" : "Regenerated"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-panel-border px-8 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Before</p>
            <PieceBody value={edit.previous_value} empty="No prior draft -- this was the first save." />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">After</p>
            <PieceBody value={edit.new_value} empty="--" />
          </div>
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

function PieceBody({ value, empty }: { value: OutreachEditValue | null; empty: string }) {
  if (!value) return <p className="mt-2 text-sm text-neutral-600">{empty}</p>;

  if (value.message !== undefined) {
    return (
      <p className="mt-2 whitespace-pre-wrap rounded-xl border border-panel-border bg-neutral-950/60 p-3 text-sm leading-relaxed text-neutral-300">
        {value.message}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-panel-border bg-neutral-950/60 p-3 text-sm leading-relaxed text-neutral-300">
      <p className="font-medium text-neutral-200">{value.subject}</p>
      <p className="whitespace-pre-wrap">{value.body}</p>
      <p className="text-xs text-neutral-500">Personalization: {value.personalization_note}</p>
    </div>
  );
}

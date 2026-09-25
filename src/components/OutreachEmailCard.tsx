"use client";

import { useState } from "react";
import type { Lead, OutreachEmailStep } from "@/lib/types";

type Draft = { subject: string; body: string; personalization_note: string };

export function OutreachEmailCard({
  leadId,
  step,
  onLeadUpdated,
}: {
  leadId: string;
  step: OutreachEmailStep;
  onLeadUpdated: (lead: Lead) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft(step));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [preview, setPreview] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(toDraft(step));
    setError(null);
    setEditing(true);
  }

  async function save(content: Draft, source: "manual" | "regenerated") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/outreach`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", step: step.step, ...content, source }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      const { lead } = await res.json();
      onLeadUpdated(lead);
      setEditing(false);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${step.subject}\n\n${step.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/regenerate-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", step: step.step, instruction: instruction || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Regeneration failed");
      const { draft: result } = await res.json();
      setPreview({ subject: result.subject, body: result.body, personalization_note: result.personalization_note });
      setRegenOpen(false);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border-l-4 border-l-accent border-y border-r border-panel-border bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          Email {step.step} -- draft
          {step.edited_at && (
            <span className="ml-2 normal-case text-neutral-500">
              &middot; edited {new Date(step.edited_at).toLocaleString()}
            </span>
          )}
        </p>
        {!editing && (
          <div className="flex shrink-0 items-center gap-3 text-xs font-medium text-neutral-500">
            <button onClick={copy} className="hover:text-neutral-200">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button onClick={startEdit} className="hover:text-neutral-200">
              Edit
            </button>
            <button onClick={() => setRegenOpen((v) => !v)} className="hover:text-neutral-200">
              Regenerate
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <LabeledInput label="Subject" value={draft.subject} onChange={(v) => setDraft((d) => ({ ...d, subject: v }))} />
          <LabeledTextarea label="Body" value={draft.body} onChange={(v) => setDraft((d) => ({ ...d, body: v }))} rows={8} />
          <LabeledTextarea
            label="Personalization note"
            value={draft.personalization_note}
            onChange={(v) => setDraft((d) => ({ ...d, personalization_note: v }))}
            rows={2}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-100"
            >
              Cancel
            </button>
            <button
              onClick={() => save(draft, "manual")}
              disabled={saving}
              className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-base font-medium text-neutral-100">{step.subject}</p>
          <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{step.body}</p>
          <p className="mt-3 max-w-prose text-xs italic leading-relaxed text-neutral-500">{step.personalization_note}</p>
        </>
      )}

      {regenOpen && !editing && (
        <div className="mt-4 rounded-xl border border-panel-border bg-neutral-900/60 p-4">
          <label className="text-xs font-medium text-neutral-400">
            Optional tweak instruction
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='e.g. "make this more casual" or "shorter"'
              className="mt-1.5 w-full rounded-md border border-panel-border bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent/50 focus:outline-none"
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setRegenOpen(false)}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-100"
            >
              Cancel
            </button>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-accent-soft disabled:opacity-50"
            >
              {regenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {error && !editing && !regenOpen && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            Regenerated preview -- not saved yet
          </p>
          <p className="mt-2 text-sm font-medium text-neutral-100">{preview.subject}</p>
          <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{preview.body}</p>
          <p className="mt-2 max-w-prose text-xs italic leading-relaxed text-neutral-500">{preview.personalization_note}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setPreview(null)}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-100"
            >
              Discard
            </button>
            <button
              onClick={() => save(preview, "regenerated")}
              disabled={saving}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-accent-soft disabled:opacity-50"
            >
              {saving ? "Keeping..." : "Keep this version"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function toDraft(step: OutreachEmailStep): Draft {
  return { subject: step.subject, body: step.body, personalization_note: step.personalization_note };
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs font-medium text-neutral-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-panel-border bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-accent/50 focus:outline-none"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-xs font-medium text-neutral-500">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full resize-y rounded-md border border-panel-border bg-neutral-950 px-3 py-2 text-sm leading-relaxed text-neutral-100 focus:border-accent/50 focus:outline-none"
      />
    </label>
  );
}

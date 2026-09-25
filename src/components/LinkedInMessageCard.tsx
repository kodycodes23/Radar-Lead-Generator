"use client";

import { useEffect, useState } from "react";
import type { Lead } from "@/lib/types";
import { clearPendingRegen, getPendingRegen, regenKey, setPendingRegen } from "@/lib/pendingRegenerations";

export function LinkedInMessageCard({
  leadId,
  message,
  editedAt,
  onLeadUpdated,
}: {
  leadId: string;
  message: string;
  editedAt: string | null;
  onLeadUpdated: (lead: Lead) => void;
}) {
  const key = regenKey(leadId, "linkedin");
  const pending = getPendingRegen(key);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [regenerating, setRegenerating] = useState(pending?.status === "pending");
  const [preview, setPreview] = useState<string | null>(pending?.status === "done" ? pending.result.message : null);
  const [error, setError] = useState<string | null>(pending?.status === "error" ? pending.message : null);

  // Picks up a regeneration that was already running before this component
  // mounted (e.g. the user switched tabs mid-generation and came back).
  useEffect(() => {
    if (!regenerating) return;
    const interval = setInterval(() => {
      const current = getPendingRegen(key);
      if (current?.status === "done") {
        setPreview(current.result.message);
        setRegenerating(false);
      } else if (current?.status === "error") {
        setError(current.message);
        setRegenerating(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [regenerating, key]);

  function startEdit() {
    setDraft(message);
    setError(null);
    setEditing(true);
  }

  async function save(content: string, source: "manual" | "regenerated") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/outreach`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "linkedin", message: content, source }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      const { lead } = await res.json();
      onLeadUpdated(lead);
      setEditing(false);
      setPreview(null);
      clearPendingRegen(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    setPendingRegen(key, { status: "pending" });
    try {
      const res = await fetch(`/api/leads/${leadId}/regenerate-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "linkedin", instruction: instruction || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Regeneration failed");
      const { draft: result } = await res.json();
      setPendingRegen(key, { status: "done", result: { message: result.message } });
      setPreview(result.message);
      setRegenOpen(false);
      setInstruction("");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPendingRegen(key, { status: "error", message });
      setError(message);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border-l-4 border-l-sky-400 border-y border-r border-panel-border bg-sky-400/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-300">
          <span aria-hidden>&#128172;</span> LinkedIn message -- draft
          {editedAt && <span className="ml-1 normal-case text-sky-300/60">&middot; edited {new Date(editedAt).toLocaleString()}</span>}
        </p>
        {!editing && (
          <div className="flex shrink-0 items-center gap-3 text-xs font-medium text-sky-300/70">
            <button onClick={copy} className="hover:text-sky-100">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button onClick={startEdit} className="hover:text-sky-100">
              Edit
            </button>
            <button onClick={() => setRegenOpen((v) => !v)} className="hover:text-sky-100">
              Regenerate
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-md border border-panel-border bg-neutral-950 px-3 py-2 text-sm leading-relaxed text-neutral-100 focus:border-sky-400/50 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-100">
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
        <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{message}</p>
      )}

      {regenOpen && !editing && (
        <div className="mt-4 rounded-xl border border-panel-border bg-neutral-950/40 p-4">
          <label className="text-xs font-medium text-neutral-400">
            Optional tweak instruction
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='e.g. "focus on their hiring signal instead"'
              className="mt-1.5 w-full rounded-md border border-panel-border bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-400/50 focus:outline-none"
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setRegenOpen(false)} className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-100">
              Cancel
            </button>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="rounded-full bg-sky-400 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-sky-300 disabled:opacity-50"
            >
              {regenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {error && !editing && !regenOpen && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="mt-4 rounded-xl border border-sky-400/40 bg-sky-400/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">Regenerated preview -- not saved yet</p>
          <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{preview}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setPreview(null);
                clearPendingRegen(key);
              }}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-100"
            >
              Discard
            </button>
            <button
              onClick={() => save(preview, "regenerated")}
              disabled={saving}
              className="rounded-full bg-sky-400 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-sky-300 disabled:opacity-50"
            >
              {saving ? "Keeping..." : "Keep this version"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeEffectiveLimits } from "@/lib/limits";
import { DEFAULT_RUN_LIMITS, RUN_PRIORITY_OPTIONS, type IcpCriteria, type RunPriority } from "@/lib/types";
import type { SimilarRun } from "@/lib/db";

const EXAMPLE_OBJECTIVE =
  "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support.";

const LIMIT_LABELS: Record<string, string> = {
  lead_count_target: "Qualified leads target",
  max_companies_searched: "Max companies discovered",
  max_websites_scraped: "Max websites scraped",
  max_agent_turns: "Max agent turns",
  max_tool_calls: "Max tool calls",
};

type FieldKey = "target_company_type" | "industries" | "geography" | "business_problem" | "headcount_range" | "buyer_persona";
type Designation = "skip" | "nice" | "must";

const FIELD_LABELS: Record<FieldKey, string> = {
  target_company_type: "Company type",
  industries: "Industries",
  geography: "Geography",
  business_problem: "What they need help with",
  headcount_range: "Headcount",
  buyer_persona: "Buyer persona",
};

// Search-shaping fields (company type/industry/geography directly become
// discover_companies query terms) default to must-have; qualification-shaping
// fields default to nice-to-have -- same reasoning as the icp-refinement
// skill's own hard/soft guidance, since headcount specifically being forced
// hard was the direct cause of a real low-yield problem earlier this session.
const DEFAULT_DESIGNATIONS: Record<FieldKey, Designation> = {
  target_company_type: "must",
  industries: "must",
  geography: "must",
  business_problem: "nice",
  headcount_range: "nice",
  buyer_persona: "nice",
};

function fieldValue(icp: IcpCriteria, key: FieldKey): string {
  if (key === "industries") return icp.industries.join(", ");
  if (key === "geography") return icp.geography.join(", ");
  return icp[key];
}

export function RunForm() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [limits, setLimits] = useState({ ...DEFAULT_RUN_LIMITS });
  const [priority, setPriority] = useState<RunPriority>("balanced");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [similarRuns, setSimilarRuns] = useState<SimilarRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loadingFilters, setLoadingFilters] = useState(false);
  const [icpSuggestion, setIcpSuggestion] = useState<IcpCriteria | null>(null);
  const [designations, setDesignations] = useState<Record<FieldKey, Designation>>(DEFAULT_DESIGNATIONS);
  // Editable text per field, seeded from the inferred suggestion -- for a
  // vague objective the inference is often a broad generic guess (e.g.
  // "Technology, Professional Services, Manufacturing, ..."), and the user
  // needs to be able to replace it outright, not just toggle must/nice/skip
  // on a value they never asked for.
  const [fieldEdits, setFieldEdits] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [customFilters, setCustomFilters] = useState<{ text: string; designation: "must" | "nice" }[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [finalIcp, setFinalIcp] = useState<IcpCriteria | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const effectiveLimits = computeEffectiveLimits(limits, priority);

  async function openFilterModal() {
    if (!objective.trim()) {
      setError("Enter a qualification objective first.");
      return;
    }
    setError(null);
    setFilterError(null);
    setLoadingFilters(true);
    try {
      const res = await fetch("/api/runs/infer-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setIcpSuggestion(data.icp);
      setDesignations(DEFAULT_DESIGNATIONS);
      setFieldEdits(
        Object.fromEntries((Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => [k, fieldValue(data.icp, k)])) as Record<
          FieldKey,
          string
        >
      );
      setCustomFilters([]);
      setShowFilterModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFilters(false);
    }
  }

  function confirmFilters() {
    if (!icpSuggestion) return;
    const hard: string[] = [];
    const soft: string[] = [];
    for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
      const value = fieldEdits[key] ?? "";
      if (designations[key] === "must") hard.push(`${FIELD_LABELS[key]}: ${value}`);
      else if (designations[key] === "nice") soft.push(`${FIELD_LABELS[key]}: ${value}`);
    }
    for (const f of customFilters) {
      if (f.designation === "must") hard.push(f.text);
      else soft.push(f.text);
    }

    const arr = (key: FieldKey) => (fieldEdits[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    setFinalIcp({
      target_company_type: designations.target_company_type === "skip" ? "" : fieldEdits.target_company_type,
      industries: designations.industries === "skip" ? [] : arr("industries"),
      geography: designations.geography === "skip" ? [] : arr("geography"),
      headcount_range: designations.headcount_range === "skip" ? "" : fieldEdits.headcount_range,
      buyer_persona: designations.buyer_persona === "skip" ? "" : fieldEdits.buyer_persona,
      business_problem: designations.business_problem === "skip" ? "" : fieldEdits.business_problem,
      hard_filters: hard,
      soft_preferences: soft,
      disqualifiers: icpSuggestion.disqualifiers,
    });
    setShowFilterModal(false);
  }

  async function actuallySubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, limits, priority, icp: finalIcp ?? undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const { runId } = await res.json();
      router.push(`/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) {
      setError("Enter a qualification objective.");
      return;
    }
    setError(null);
    setCheckingSimilar(true);
    try {
      const res = await fetch("/api/runs/check-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });
      if (res.ok) {
        const { similar } = await res.json();
        if (similar.length > 0) {
          setCheckingSimilar(false);
          setSimilarRuns(similar);
          return;
        }
      }
    } catch {
      // if the similarity check itself fails, don't block the user over it
    }
    setCheckingSimilar(false);
    await actuallySubmit();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-panel-border bg-neutral-950/80 p-3 shadow-2xl shadow-black/40 backdrop-blur">
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={EXAMPLE_OBJECTIVE}
          rows={2}
          className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />

        <div className="mt-1 flex items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-panel-border bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-accent/40 hover:text-neutral-100"
            >
              <span className="text-accent">&#10022;</span>
              {limits.lead_count_target} leads target
              <span className="text-neutral-600">{showAdvanced ? "⌃" : "⌄"}</span>
            </button>
            <button
              type="button"
              onClick={openFilterModal}
              disabled={loadingFilters}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                finalIcp
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-panel-border bg-neutral-900 text-neutral-300 hover:border-accent/40 hover:text-neutral-100"
              }`}
            >
              {loadingFilters ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span aria-hidden>&#9881;</span>
              )}
              {finalIcp ? "Filters set" : "Set filters"}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || checkingSimilar}
            aria-label="Start run"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-neutral-950 transition hover:bg-accent-soft disabled:opacity-50"
          >
            {submitting || checkingSimilar ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            ) : (
              <span className="text-lg leading-none">&#8593;</span>
            )}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 space-y-4 rounded-xl border border-panel-border bg-neutral-900/60 p-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">Priority</p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Which limit is the real goal for this run -- the others expand (still hard-capped) to give it
                room.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RUN_PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      priority === opt.value
                        ? "bg-neutral-100 text-neutral-950"
                        : "border border-panel-border text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField
                label="Qualified leads target"
                value={limits.lead_count_target}
                onChange={(v) => setLimits((l) => ({ ...l, lead_count_target: v }))}
              />
              <NumberField
                label="Max companies discovered"
                value={limits.max_companies_searched}
                onChange={(v) => setLimits((l) => ({ ...l, max_companies_searched: v }))}
              />
              <NumberField
                label="Max websites scraped"
                value={limits.max_websites_scraped}
                onChange={(v) => setLimits((l) => ({ ...l, max_websites_scraped: v }))}
              />
              <NumberField
                label="Max agent turns"
                value={limits.max_agent_turns}
                onChange={(v) => setLimits((l) => ({ ...l, max_agent_turns: v }))}
              />
              <NumberField
                label="Max tool calls"
                value={limits.max_tool_calls}
                onChange={(v) => setLimits((l) => ({ ...l, max_tool_calls: v }))}
              />
            </div>

            {priority !== "balanced" && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                <p className="text-xs font-medium text-accent">Actual limits for this run</p>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-300 sm:grid-cols-3">
                  {(Object.keys(effectiveLimits) as (keyof typeof effectiveLimits)[]).map((key) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-neutral-500">{LIMIT_LABELS[key]}</span>
                      <span className={effectiveLimits[key] !== limits[key] ? "font-medium text-accent" : undefined}>
                        {effectiveLimits[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <p className="mt-2 text-center text-xs text-neutral-600">
        Every limit is still a fixed, finite cap the tools enforce -- the agent never decides its own budget.
      </p>

      {similarRuns && (
        <SimilarRunsModal
          similarRuns={similarRuns}
          onCancel={() => setSimilarRuns(null)}
          onContinue={() => {
            setSimilarRuns(null);
            actuallySubmit();
          }}
        />
      )}

      {showFilterModal && icpSuggestion && (
        <FilterModal
          designations={designations}
          setDesignations={setDesignations}
          fieldEdits={fieldEdits}
          setFieldEdits={setFieldEdits}
          customFilters={customFilters}
          setCustomFilters={setCustomFilters}
          error={filterError}
          onCancel={() => setShowFilterModal(false)}
          onConfirm={confirmFilters}
        />
      )}
    </form>
  );
}

function FilterModal({
  designations,
  setDesignations,
  fieldEdits,
  setFieldEdits,
  customFilters,
  setCustomFilters,
  error,
  onCancel,
  onConfirm,
}: {
  designations: Record<FieldKey, Designation>;
  setDesignations: Dispatch<SetStateAction<Record<FieldKey, Designation>>>;
  fieldEdits: Record<FieldKey, string>;
  setFieldEdits: Dispatch<SetStateAction<Record<FieldKey, string>>>;
  customFilters: { text: string; designation: "must" | "nice" }[];
  setCustomFilters: Dispatch<SetStateAction<{ text: string; designation: "must" | "nice" }[]>>;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [customText, setCustomText] = useState("");
  const [customDesignation, setCustomDesignation] = useState<"must" | "nice">("must");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-panel-border bg-neutral-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-neutral-50">Review the ICP before running</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Each field is editable -- overwrite a guess if your objective didn&apos;t actually specify it. Then decide
          how much it matters: a <strong>must-have</strong> rejects any company that fails it, a{" "}
          <strong>nice-to-have</strong> improves fit without ruling one out, and <strong>skip</strong> ignores it.
          This becomes the final ICP -- the agent won&apos;t re-derive its own.
        </p>

        <div className="mt-4 space-y-3">
          {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => (
            <div key={key} className="rounded-lg border border-panel-border bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {FIELD_LABELS[key]}
                </p>
                <div className="flex gap-1">
                  {(["skip", "nice", "must"] as Designation[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDesignations((prev) => ({ ...prev, [key]: d }))}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        designations[key] === d
                          ? "bg-neutral-100 text-neutral-950"
                          : "border border-panel-border text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {d === "skip" ? "Skip" : d === "nice" ? "Nice to have" : "Must have"}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={fieldEdits[key] ?? ""}
                onChange={(e) => setFieldEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={key === "industries" || key === "geography" ? "Comma-separated" : undefined}
                className="mt-1.5 w-full rounded-md border border-panel-border bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent/50 focus:outline-none"
              />
            </div>
          ))}
        </div>

        {customFilters.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {customFilters.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-panel-border bg-neutral-900/60 px-3 py-2 text-sm"
              >
                <span className="text-neutral-300">
                  {f.text} <span className="text-neutral-600">({f.designation === "must" ? "must have" : "nice to have"})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCustomFilters((prev) => prev.filter((_, j) => j !== i))}
                  className="text-neutral-500 hover:text-red-400"
                  aria-label="Remove filter"
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Add your own, e.g. Has a public pricing page"
            className="min-w-0 flex-1 rounded-lg border border-panel-border bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent/50 focus:outline-none"
          />
          <select
            value={customDesignation}
            onChange={(e) => setCustomDesignation(e.target.value as "must" | "nice")}
            className="rounded-lg border border-panel-border bg-neutral-950 px-2 py-2 text-sm text-neutral-300 focus:border-accent/50 focus:outline-none"
          >
            <option value="must">Must have</option>
            <option value="nice">Nice to have</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (!customText.trim()) return;
              setCustomFilters((prev) => [...prev, { text: customText.trim(), designation: customDesignation }]);
              setCustomText("");
            }}
            className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-neutral-300 hover:border-accent/40 hover:text-accent"
          >
            Add
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-panel-border px-4 py-2 text-sm font-medium text-neutral-300 transition hover:text-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-accent-soft"
          >
            Confirm filters
          </button>
        </div>
      </div>
    </div>
  );
}

function SimilarRunsModal({
  similarRuns,
  onCancel,
  onContinue,
}: {
  similarRuns: SimilarRun[];
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-2xl border border-panel-border bg-neutral-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-neutral-50">You&apos;ve run something similar before</h2>
        <p className="mt-1 text-sm text-neutral-400">
          These past runs look close to this objective. Run it anyway, or check them first?
        </p>
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {similarRuns.map((r) => (
            <Link
              key={r.id}
              href={`/runs/${r.id}`}
              target="_blank"
              className="block rounded-lg border border-panel-border bg-neutral-900/60 p-3 transition hover:border-accent/40"
            >
              <p className="truncate text-sm text-neutral-200">{r.objective}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {new Date(r.created_at).toLocaleDateString()} -- {r.status} -- {r.qualified_count}/
                {r.lead_count_target} qualified -- {Math.round(r.similarity * 100)}% similar
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-panel-border px-4 py-2 text-sm font-medium text-neutral-300 transition hover:text-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-accent-soft"
          >
            Run it anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-neutral-500">
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-panel-border bg-neutral-950 px-2 py-1 text-sm text-neutral-100 focus:border-accent/50 focus:outline-none"
      />
    </label>
  );
}

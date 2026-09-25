"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ACTIVE_RUN_STATUSES,
  RUN_PRIORITY_OPTIONS,
  type Lead,
  type OutreachEdit,
  type Run,
  type RunPriority,
  type ToolCall,
} from "@/lib/types";
import { LeadList } from "./LeadList";
import { LeadDetail } from "./LeadDetail";
import { ToolCallDetail } from "./ToolCallDetail";
import { OutreachEditDetail } from "./OutreachEditDetail";
import { truncate } from "@/lib/text";

const OUTREACH_FIELD_LABELS: Record<OutreachEdit["field"], string> = {
  email_1: "Email 1",
  email_2: "Email 2",
  email_3: "Email 3",
  linkedin: "LinkedIn message",
};

const STATUS_ORDER: Lead["qualification_status"][] = ["qualified", "needs_review", "not_qualified"];
function orderedLeads(leads: Lead[]): Lead[] {
  return STATUS_ORDER.flatMap((status) => leads.filter((l) => l.qualification_status === status));
}

const TABS = ["Overview", "Leads", "Tool calls", "Outreach edits"] as const;
type Tab = (typeof TABS)[number];

export function RunLiveView({
  runId,
  initialRun,
  initialLeads,
  initialToolCalls,
  initialFamily,
  initialOutreachEdits,
}: {
  runId: string;
  initialRun: Run;
  initialLeads: Lead[];
  initialToolCalls: ToolCall[];
  initialFamily: Run[];
  initialOutreachEdits: OutreachEdit[];
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [leads, setLeads] = useState(initialLeads);
  const [toolCalls, setToolCalls] = useState(initialToolCalls);
  const [family, setFamily] = useState(initialFamily);
  const [outreachEdits, setOutreachEdits] = useState(initialOutreachEdits);
  const [tab, setTab] = useState<Tab>("Overview");
  const [selectedToolCall, setSelectedToolCall] = useState<ToolCall | null>(null);
  const [selectedOutreachEdit, setSelectedOutreachEdit] = useState<OutreachEdit | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const hasSettledRef = useRef(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/runs/${runId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.push(`/runs/${data.runId}`);
    } catch {
      setRetrying(false);
    }
  }

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setRun(data.run);
        setLeads(data.leads);
        setToolCalls(data.toolCalls);
        setFamily(data.family);
        setOutreachEdits(data.outreachEdits);
        setSelectedToolCall((prev) =>
          prev ? (data.toolCalls as ToolCall[]).find((tc) => tc.id === prev.id) ?? prev : prev
        );
      } catch {
        // transient fetch failure -- next poll/settle attempt will retry
      }
    }

    if (ACTIVE_RUN_STATUSES.includes(run.status)) {
      hasSettledRef.current = false;
      const interval = setInterval(refresh, 2000);
      return () => clearInterval(interval);
    }

    // Just went terminal. The agent's own update_run_status call and the
    // SDK's final cost report don't land in the same instant -- a poll that
    // stops the moment status flips can miss fields (e.g.
    // estimated_claude_cost_usd) written a moment later. Do one more
    // delayed fetch to catch that, then truly stop.
    if (!hasSettledRef.current) {
      hasSettledRef.current = true;
      const timeout = setTimeout(refresh, 4000);
      return () => clearTimeout(timeout);
    }
  }, [runId, run.status]);

  const isActive = ACTIVE_RUN_STATUSES.includes(run.status);
  const sequence = orderedLeads(leads);
  const selectedIndex = selectedLeadId ? sequence.findIndex((l) => l.id === selectedLeadId) : -1;
  const selectedLead = selectedIndex >= 0 ? sequence[selectedIndex] : null;

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-panel-border px-6 py-4">
        <Link href="/runs" className="text-neutral-500 hover:text-neutral-200">
          &#8592;
        </Link>
        <span className="text-sm text-neutral-500">All runs</span>
      </div>

      <div className="border-b border-panel-border px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-neutral-50">{run.objective}</h1>
          <StatusBadge status={run.status} pulsing={isActive} />
          {run.attempt_number > 1 && (
            <span className="rounded-full border border-panel-border px-2.5 py-1 text-xs font-medium text-neutral-400">
              Attempt {run.attempt_number}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {leads.length > 0 && (
              <a
                href={`/api/runs/${runId}/export`}
                className="flex items-center gap-1.5 rounded-full border border-panel-border px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-accent/40 hover:text-accent"
              >
                <span aria-hidden>&#8681;</span> Export CSV{family.length > 1 ? " (this attempt)" : ""}
              </a>
            )}
            {family.length > 1 && (
              <a
                href={`/api/runs/${runId}/export?scope=family`}
                className="flex items-center gap-1.5 rounded-full border border-panel-border px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-accent/40 hover:text-accent"
              >
                <span aria-hidden>&#8681;</span> Export all {family.length} attempts
              </a>
            )}
            {!isActive && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-1.5 rounded-full border border-panel-border px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                <span aria-hidden>&#8635;</span> {retrying ? "Starting..." : "Retry for more leads"}
              </button>
            )}
          </div>
        </div>
        {family.length > 1 && (
          <p className="mt-2 text-xs text-neutral-500">
            Part of a {family.length}-attempt retry chain:{" "}
            {family.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ", "}
                {r.id === runId ? (
                  <span className="text-neutral-300">Attempt {r.attempt_number} (this one)</span>
                ) : (
                  <Link href={`/runs/${r.id}`} className="underline underline-offset-2 hover:text-accent">
                    Attempt {r.attempt_number}
                  </Link>
                )}
              </span>
            ))}
          </p>
        )}
        {run.error_message && (
          <div
            className={`mt-2 max-w-2xl rounded-lg px-3 py-2 text-sm ${
              run.status === "completed" ? "bg-amber-400/10 text-amber-300" : "bg-red-400/10 text-red-300"
            }`}
          >
            <p>
              {run.status === "completed" && (
                <span className="font-medium">Didn&apos;t reach the qualified-leads target: </span>
              )}
              {run.error_summary ?? truncate(run.error_message, 160)}
            </p>
            <Link
              href="/errors"
              className={`mt-1 inline-block text-xs underline underline-offset-2 ${
                run.status === "completed" ? "hover:text-amber-200" : "hover:text-red-200"
              }`}
            >
              View full detail in the error log &#8594;
            </Link>
          </div>
        )}

        {run.status === "needs_clarification" && run.clarification_question && (
          <ClarificationPrompt runId={runId} question={run.clarification_question} />
        )}

        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-neutral-100 text-neutral-950"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              }`}
            >
              {t}
              {t === "Leads" && leads.length > 0 && (
                <span className="ml-1.5 opacity-60">{leads.length}</span>
              )}
              {t === "Tool calls" && toolCalls.length > 0 && (
                <span className="ml-1.5 opacity-60">{toolCalls.length}</span>
              )}
              {t === "Outreach edits" && outreachEdits.length > 0 && (
                <span className="ml-1.5 opacity-60">{outreachEdits.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {tab === "Overview" && (
          <div className="space-y-6">
            <ProgressSummary run={run} />
            <RunLimitsPanel run={run} />
            {run.refined_icp ? (
              <IcpPanel icp={run.refined_icp} />
            ) : (
              <EmptyState
                icon="&#10022;"
                title="Refining ICP"
                description="The agent is turning your objective into structured ICP criteria."
              />
            )}
          </div>
        )}

        {tab === "Leads" && (
          <>
            {leads.length === 0 ? (
              <EmptyState
                icon="&#128193;"
                title="No leads yet"
                description="Companies discovered and qualified by the agent will appear here."
              />
            ) : selectedLead ? (
              <LeadDetail
                lead={selectedLead}
                index={selectedIndex}
                total={sequence.length}
                onBack={() => setSelectedLeadId(null)}
                onPrev={() => setSelectedLeadId(sequence[selectedIndex - 1]?.id ?? null)}
                onNext={() => setSelectedLeadId(sequence[selectedIndex + 1]?.id ?? null)}
                onLeadUpdated={(updated) =>
                  setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
                }
              />
            ) : (
              <LeadList leads={leads} onSelect={(lead) => setSelectedLeadId(lead.id)} />
            )}
          </>
        )}

        {tab === "Tool calls" && (
          <div className="overflow-hidden rounded-2xl border border-panel-border bg-panel">
            {toolCalls.length === 0 ? (
              <EmptyState icon="&#9881;" title="No tool calls yet" description="Every tool call the agent makes will be logged here." />
            ) : (
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="min-w-full divide-y divide-panel-border text-sm">
                  <thead className="sticky top-0 bg-panel text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Tool</th>
                      <th className="px-4 py-2">Purpose</th>
                      <th className="px-4 py-2">Result</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-border">
                    {toolCalls.map((tc) => (
                      <tr
                        key={tc.id}
                        onClick={() => setSelectedToolCall(tc)}
                        className={`cursor-pointer transition hover:bg-neutral-900/80 ${
                          tc.status === "error" ? "bg-red-400/5" : undefined
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                          {new Date(tc.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-neutral-300">{tc.tool_name}</td>
                        <td className="max-w-xs truncate px-4 py-2 text-neutral-400">{tc.purpose}</td>
                        <td className="max-w-sm truncate px-4 py-2 text-neutral-400">
                          {tc.status === "error" ? tc.error_message : tc.result_summary}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              tc.status === "error" ? "text-red-300" : "text-emerald-300"
                            }`}
                          >
                            {tc.status === "error" && <span aria-hidden>&#9888;</span>}
                            {tc.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-neutral-500">
                          {tc.cost_usd ? `$${Number(tc.cost_usd).toFixed(4)}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "Outreach edits" && (
          <div className="overflow-hidden rounded-2xl border border-panel-border bg-panel">
            {outreachEdits.length === 0 ? (
              <EmptyState
                icon="&#9999;"
                title="No outreach edits yet"
                description="Manual edits and kept regenerations for this run's outreach drafts will appear here."
              />
            ) : (
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="min-w-full divide-y divide-panel-border text-sm">
                  <thead className="sticky top-0 bg-panel text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Lead</th>
                      <th className="px-4 py-2">Field</th>
                      <th className="px-4 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-border">
                    {outreachEdits.map((edit) => {
                      const lead = leads.find((l) => l.id === edit.lead_id);
                      return (
                        <tr
                          key={edit.id}
                          onClick={() => setSelectedOutreachEdit(edit)}
                          className="cursor-pointer transition hover:bg-neutral-900/80"
                        >
                          <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                            {new Date(edit.created_at).toLocaleString()}
                          </td>
                          <td className="max-w-xs truncate px-4 py-2 text-neutral-300">
                            {lead?.company_name ?? "--"}
                          </td>
                          <td className="px-4 py-2 text-neutral-400">{OUTREACH_FIELD_LABELS[edit.field]}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                edit.source === "manual" ? "bg-sky-400/15 text-sky-300" : "bg-violet-400/15 text-violet-300"
                              }`}
                            >
                              {edit.source === "manual" ? "Manual" : "Regenerated"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedToolCall && (
        <ToolCallDetail toolCall={selectedToolCall} onClose={() => setSelectedToolCall(null)} />
      )}
      {selectedOutreachEdit && (
        <OutreachEditDetail
          edit={selectedOutreachEdit}
          leadName={leads.find((l) => l.id === selectedOutreachEdit.lead_id)?.company_name ?? "Unknown lead"}
          onClose={() => setSelectedOutreachEdit(null)}
        />
      )}
    </div>
  );
}

function ClarificationPrompt({ runId, question }: { runId: string; question: string }) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit the answer.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Failed to submit the answer -- check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 max-w-2xl rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
        The agent paused this run and needs your input
      </p>
      <p className="mt-1.5 text-sm text-neutral-100">{question}</p>

      {submitted ? (
        <p className="mt-3 text-sm text-emerald-300">Answer sent -- resuming the run.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Type your answer..."
            disabled={submitting}
            className="flex-1 rounded-lg border border-panel-border bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={submitting || !answer.trim()}
            className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Answer"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function ProgressSummary({ run }: { run: Run }) {
  const items = [
    { label: "Companies discovered", value: `${run.companies_discovered_count}/${run.max_companies_searched}` },
    { label: "Websites scraped", value: `${run.websites_scraped_count}/${run.max_websites_scraped}` },
    { label: "Qualified", value: `${run.qualified_count}/${run.lead_count_target}` },
    { label: "Needs review", value: run.needs_review_count },
    { label: "Not qualified", value: run.not_qualified_count },
    { label: "Apify cost (est.)", value: `$${Number(run.estimated_apify_cost_usd).toFixed(3)}` },
    { label: "Claude cost (est.)", value: `$${Number(run.estimated_claude_cost_usd).toFixed(3)}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-panel-border bg-panel p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-neutral-500">{item.label}</p>
          <p className="text-lg font-semibold text-neutral-100">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RunLimitsPanel({ run }: { run: Run }) {
  const items: { label: string; value: number; field: RunPriority }[] = [
    { label: "Qualified leads target", value: run.lead_count_target, field: "qualified_leads" },
    { label: "Max companies searched", value: run.max_companies_searched, field: "companies_discovered" },
    { label: "Max websites scraped", value: run.max_websites_scraped, field: "websites_scraped" },
    { label: "Max agent turns", value: run.max_agent_turns, field: "agent_turns" },
    { label: "Max tool calls", value: run.max_tool_calls, field: "tool_calls" },
  ];
  const priorityLabel = RUN_PRIORITY_OPTIONS.find((o) => o.value === run.priority)?.label ?? run.priority;

  return (
    <section className="rounded-2xl border border-panel-border bg-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Run limits</h2>
        <span className="rounded-full border border-panel-border px-2.5 py-1 text-xs font-medium text-neutral-400">
          Priority: {priorityLabel}
        </span>
      </div>
      <p className="text-xs text-neutral-500">
        Hard caps enforced by the tools themselves for this run -- not agent discretion. Non-balanced priorities
        expand the other limits (still to a fixed ceiling) to support the highlighted one.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-neutral-500">{item.label}</dt>
            <dd
              className={`mt-0.5 text-lg font-semibold ${
                item.field === run.priority ? "text-accent" : "text-neutral-100"
              }`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function IcpPanel({ icp }: { icp: NonNullable<Run["refined_icp"]> }) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-neutral-200">Refined ICP</h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Target company type" value={icp.target_company_type} />
        <Field label="Headcount range" value={icp.headcount_range} />
        <Field label="Industries" value={icp.industries.join(", ")} />
        <Field label="Geography" value={icp.geography.join(", ")} />
        <Field label="Buyer persona" value={icp.buyer_persona} />
        <Field label="Business problem" value={icp.business_problem} />
        <Field label="Hard filters" value={icp.hard_filters.join("; ")} />
        <Field label="Soft preferences" value={icp.soft_preferences.join("; ")} />
        <Field label="Disqualifiers" value={icp.disqualifiers.join("; ")} />
      </dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-300">{value || "--"}</dd>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-panel-border bg-panel px-6 py-16 text-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-lg text-neutral-500"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      <p className="font-medium text-neutral-200">{title}</p>
      <p className="max-w-sm text-sm text-neutral-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status, pulsing }: { status: string; pulsing?: boolean }) {
  const color =
    status === "completed"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "failed"
        ? "bg-red-400/15 text-red-300"
        : "bg-amber-400/15 text-amber-300";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {pulsing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}

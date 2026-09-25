"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";
import { OutreachEmailCard } from "./OutreachEmailCard";
import { LinkedInMessageCard } from "./LinkedInMessageCard";

const STATUS_META: Record<
  Lead["qualification_status"],
  { label: string; badge: string; accent: string }
> = {
  qualified: {
    label: "Qualified",
    badge: "border-emerald-400/30 bg-emerald-400/15 text-emerald-300",
    accent: "border-l-emerald-400",
  },
  needs_review: {
    label: "Needs review",
    badge: "border-amber-400/30 bg-amber-400/15 text-amber-300",
    accent: "border-l-amber-400",
  },
  not_qualified: {
    label: "Not qualified",
    badge: "border-neutral-700 bg-neutral-800 text-neutral-400",
    accent: "border-l-neutral-700",
  },
};

export function LeadDetail({
  lead,
  index,
  total,
  onBack,
  onPrev,
  onNext,
  onLeadUpdated,
}: {
  lead: Lead;
  index: number;
  total: number;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLeadUpdated: (lead: Lead) => void;
}) {
  const [activeEmail, setActiveEmail] = useState(0);
  const [showAllEmails, setShowAllEmails] = useState(false);
  const status = STATUS_META[lead.qualification_status];
  const steps = lead.outreach_email_sequence.slice().sort((a, b) => a.step - b.step);

  return (
    <div>
      {/* Nav bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-neutral-100"
        >
          <span aria-hidden>&#8592;</span> Back to leads
        </button>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <button
            onClick={onPrev}
            disabled={index === 0}
            className="transition hover:text-neutral-100 disabled:opacity-30 disabled:hover:text-neutral-500"
          >
            &#9664; Prev
          </button>
          <span className="tabular-nums text-neutral-600">
            {index + 1} / {total}
          </span>
          <button
            onClick={onNext}
            disabled={index === total - 1}
            className="transition hover:text-neutral-100 disabled:opacity-30 disabled:hover:text-neutral-500"
          >
            Next &#9654;
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="mt-6 rounded-2xl border border-panel-border bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">{lead.company_name}</h1>
            <a
              href={`https://${lead.company_domain}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-neutral-500 underline underline-offset-2 hover:text-accent"
            >
              {lead.company_domain}
            </a>
            {(lead.company_email || lead.company_linkedin_url) && (
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-500">
                {lead.company_email && (
                  <a href={`mailto:${lead.company_email}`} className="underline underline-offset-2 hover:text-accent">
                    {lead.company_email}
                  </a>
                )}
                {lead.company_linkedin_url && (
                  <a
                    href={lead.company_linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-accent"
                  >
                    Company LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${status.badge}`}>
              {status.label}
            </span>
            {lead.confidence !== null && (
              <span className="text-sm text-neutral-400">
                Confidence <span className="font-semibold text-neutral-100">{Math.round(lead.confidence * 100)}%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Qualification reasoning */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Qualification reasoning</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
              <span aria-hidden>&#10003;</span> Fit reasons ({lead.fit_reasons.length})
            </p>
            {lead.fit_reasons.length > 0 ? (
              <ul className="mt-3 max-w-prose list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-300">
                {lead.fit_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">None recorded.</p>
            )}
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
              <span aria-hidden>&#9888;</span> Concerns ({lead.concerns.length})
            </p>
            {lead.concerns.length > 0 ? (
              <ul className="mt-3 max-w-prose list-inside list-disc space-y-2 text-sm leading-relaxed text-neutral-300">
                {lead.concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">None recorded.</p>
            )}
          </div>
        </div>
      </section>

      {/* Source context */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source context</h2>
        <div className="mt-3 rounded-2xl border border-panel-border bg-neutral-900/40 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Summary</p>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-neutral-300">
            {lead.source_summary || "No summary recorded."}
          </p>
          {lead.source_urls.length > 0 && (
            <>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Sources</p>
              <ul className="mt-1.5 space-y-1">
                {lead.source_urls.map((u, i) => (
                  <li key={i} className="truncate text-xs">
                    <a href={u} target="_blank" rel="noreferrer" className="text-neutral-500 underline underline-offset-2 hover:text-accent">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Outreach */}
      {(steps.length > 0 || lead.outreach_linkedin_message) && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Outreach drafts <span className="normal-case text-neutral-600">-- for review, nothing is sent</span>
          </h2>

          {steps.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1">
                  {steps.map((step, i) => (
                    <button
                      key={step.step}
                      onClick={() => {
                        setActiveEmail(i);
                        setShowAllEmails(false);
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        !showAllEmails && activeEmail === i
                          ? "bg-neutral-100 text-neutral-950"
                          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                      }`}
                    >
                      Email {step.step}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAllEmails((v) => !v)}
                  className="text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-200"
                >
                  {showAllEmails ? "Show one at a time" : "Show all 3 instead"}
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {(showAllEmails ? steps : [steps[activeEmail]]).map((step) => (
                  <OutreachEmailCard key={step.step} leadId={lead.id} step={step} onLeadUpdated={onLeadUpdated} />
                ))}
              </div>
            </div>
          )}

          {lead.outreach_linkedin_message && (
            <LinkedInMessageCard
              leadId={lead.id}
              message={lead.outreach_linkedin_message}
              editedAt={lead.outreach_linkedin_edited_at}
              onLeadUpdated={onLeadUpdated}
            />
          )}
        </section>
      )}
    </div>
  );
}

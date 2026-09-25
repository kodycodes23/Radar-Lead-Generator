"use client";

import type { Lead } from "@/lib/types";

const STATUS_DOT: Record<Lead["qualification_status"], string> = {
  qualified: "bg-emerald-400",
  not_qualified: "bg-neutral-600",
  needs_review: "bg-amber-400",
};

const GROUPS: { key: Lead["qualification_status"]; title: string }[] = [
  { key: "qualified", title: "Qualified" },
  { key: "needs_review", title: "Needs review" },
  { key: "not_qualified", title: "Not qualified" },
];

export function LeadList({ leads, onSelect }: { leads: Lead[]; onSelect: (lead: Lead) => void }) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => {
        const rows = leads.filter((l) => l.qualification_status === group.key);
        if (rows.length === 0) return null;
        return (
          <section key={group.key}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {group.title} ({rows.length})
            </h2>
            <div className="mt-2 overflow-hidden rounded-2xl border border-panel-border bg-panel">
              {rows.map((lead, i) => (
                <button
                  key={lead.id}
                  onClick={() => onSelect(lead)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-900/80 ${
                    i > 0 ? "border-t border-panel-border" : ""
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[lead.qualification_status]}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-100">
                    {lead.company_name}
                  </span>
                  <span className="hidden w-48 shrink-0 truncate text-sm text-neutral-500 sm:block">
                    {lead.company_domain}
                  </span>
                  {lead.confidence !== null && (
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      {Math.round(lead.confidence * 100)}%
                    </span>
                  )}
                  <span className="shrink-0 text-neutral-600" aria-hidden>
                    &#8250;
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

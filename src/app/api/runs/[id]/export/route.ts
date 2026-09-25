import { NextResponse } from "next/server";
import { getLeadsForRun, getRun, getRunFamily } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import type { Lead } from "@/lib/types";

const HEADERS = [
  "attempt",
  "company_name",
  "company_domain",
  "company_email",
  "company_linkedin_url",
  "qualification_status",
  "confidence",
  "fit_reasons",
  "concerns",
  "source_summary",
  "source_urls",
  "discovery_query",
];

function leadRow(attemptNumber: number, l: Lead): (string | number | null)[] {
  return [
    attemptNumber,
    l.company_name,
    l.company_domain,
    l.company_email,
    l.company_linkedin_url,
    l.qualification_status,
    l.confidence,
    l.fit_reasons.join("; "),
    l.concerns.join("; "),
    l.source_summary,
    l.source_urls.join("; "),
    l.discovery_query,
  ];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = new URL(request.url).searchParams.get("scope"); // "family" or absent (this run only)

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  let rows: (string | number | null)[][];
  if (scope === "family") {
    const family = await getRunFamily(id);
    const leadsByRun = await Promise.all(family.map((r) => getLeadsForRun(r.id)));
    rows = family.flatMap((r, i) => leadsByRun[i].map((l) => leadRow(r.attempt_number, l)));
  } else {
    const leads = await getLeadsForRun(id);
    rows = leads.map((l) => leadRow(run.attempt_number, l));
  }

  const csv = toCsv(HEADERS, rows);
  const safeObjective = run.objective.slice(0, 40).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const suffix = scope === "family" ? "-all-attempts" : "";
  const filename = `radar-leads-${safeObjective || run.id}${suffix}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

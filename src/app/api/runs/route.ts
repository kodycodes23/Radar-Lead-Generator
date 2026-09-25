import { NextResponse } from "next/server";
import { createRun, listRuns } from "@/lib/db";
import { computeEffectiveLimits } from "@/lib/limits";
import { DEFAULT_RUN_LIMITS, RUN_PRIORITY_FIELD, type IcpCriteria, type RunLimits, type RunPriority } from "@/lib/types";
import { runAgent } from "@/agent/runAgent";

// Used by the sidebar's "Recent" list and the /runs table to poll for
// status changes -- neither is tied to one run's own live-polling page, so
// they need their own lightweight list fetch.
export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit")) || 50;
  const runs = await listRuns(limit);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const objective = typeof body?.objective === "string" ? body.objective.trim() : "";

  if (!objective) {
    return NextResponse.json({ error: "objective is required" }, { status: 400 });
  }

  const overrides = (body?.limits ?? {}) as Partial<RunLimits>;
  const baseLimits: RunLimits = {
    lead_count_target: positiveIntOr(overrides.lead_count_target, DEFAULT_RUN_LIMITS.lead_count_target),
    max_companies_searched: positiveIntOr(
      overrides.max_companies_searched,
      DEFAULT_RUN_LIMITS.max_companies_searched
    ),
    max_websites_scraped: positiveIntOr(overrides.max_websites_scraped, DEFAULT_RUN_LIMITS.max_websites_scraped),
    max_agent_turns: positiveIntOr(overrides.max_agent_turns, DEFAULT_RUN_LIMITS.max_agent_turns),
    max_tool_calls: positiveIntOr(overrides.max_tool_calls, DEFAULT_RUN_LIMITS.max_tool_calls),
  };

  const priority: RunPriority = RUN_PRIORITY_FIELD[body?.priority as RunPriority] !== undefined
    ? (body.priority as RunPriority)
    : "balanced";

  // Computed once, here, before the run starts -- the agent never sees or
  // adjusts its own budget. "balanced" returns baseLimits unchanged; any
  // other priority expands the non-priority dimensions, still to a fixed,
  // finite ceiling (see computeEffectiveLimits).
  const limits = computeEffectiveLimits(baseLimits, priority);

  // Present when the user finalized the ICP themselves in the pre-run filter
  // modal -- only lightly shape-checked here; the real structural guard is
  // save_refined_icp's icpSaved refusal in tools.ts, not this endpoint.
  const presetIcp: IcpCriteria | null =
    body?.icp && typeof body.icp === "object" && Array.isArray(body.icp.hard_filters) ? (body.icp as IcpCriteria) : null;

  const run = await createRun(objective, limits, priority, presetIcp);

  // Fire-and-forget: the agent loop runs for minutes, far longer than this
  // request should stay open. Requires a long-lived host process -- see the
  // note in src/agent/runAgent.ts.
  runAgent(run.id).catch((error) => {
    console.error(`runAgent(${run.id}) crashed outside its own error handling:`, error);
  });

  return NextResponse.json({ runId: run.id }, { status: 201 });
}

function positiveIntOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? Math.floor(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

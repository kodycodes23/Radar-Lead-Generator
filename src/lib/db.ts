import { supabaseAdmin } from "./supabase";
import { objectiveSimilarity } from "./similarity";
import type {
  IcpCriteria,
  Lead,
  OutreachEdit,
  OutreachEditValue,
  OutreachEmailStep,
  OutreachField,
  QualificationStatus,
  Run,
  RunLimits,
  RunPriority,
  RunStatus,
  ToolCall,
} from "./types";

// presetIcp: when the user finalized hard/soft filters themselves in the
// pre-run filter modal, this is saved immediately so the agent never runs
// its own icp-refinement judgment for this run -- see runAgent.ts and
// save_refined_icp's icpSaved guard in tools.ts.
export async function createRun(
  objective: string,
  limits: RunLimits,
  priority: RunPriority,
  presetIcp?: IcpCriteria | null
): Promise<Run> {
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .insert({
      objective,
      status: "pending",
      priority,
      refined_icp: presetIcp ?? null,
      ...limits,
    })
    .select("*")
    .single();

  if (error) throw new Error(`createRun failed: ${error.message}`);
  return data as Run;
}

// All runs sharing the same retry chain (the original plus every retry of
// it), ordered oldest attempt first. Accepts any member's id -- resolves to
// the family's root internally, see schema.sql's comment on retry_of_run_id.
export async function getRunFamily(anyRunIdInFamily: string): Promise<Run[]> {
  const run = await getRun(anyRunIdInFamily);
  if (!run) return [];
  const rootId = run.retry_of_run_id ?? run.id;

  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("*")
    .or(`id.eq.${rootId},retry_of_run_id.eq.${rootId}`)
    .order("attempt_number", { ascending: true });
  if (error) throw new Error(`getRunFamily failed: ${error.message}`);
  return (data ?? []) as Run[];
}

// Every company_domain already recorded as a lead anywhere in this run's
// retry family -- used to keep a retry from re-discovering/re-scraping/
// re-qualifying a company an earlier attempt already handled.
export async function getKnownDomainsForRunFamily(anyRunIdInFamily: string): Promise<Set<string>> {
  const family = await getRunFamily(anyRunIdInFamily);
  if (family.length === 0) return new Set();

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("company_domain")
    .in("run_id", family.map((r) => r.id));
  if (error) throw new Error(`getKnownDomainsForRunFamily failed: ${error.message}`);
  return new Set((data ?? []).map((r) => (r.company_domain as string).toLowerCase()));
}

// Creates a new run that re-runs an earlier one's objective/limits/priority
// verbatim, linked into its retry family so discovery can skip domains
// already found by a prior attempt.
export async function createRetryRun(originalRunId: string): Promise<Run> {
  const original = await getRun(originalRunId);
  if (!original) throw new Error(`createRetryRun: run ${originalRunId} not found`);

  const rootId = original.retry_of_run_id ?? original.id;
  const family = await getRunFamily(originalRunId);
  const nextAttempt = Math.max(0, ...family.map((r) => r.attempt_number)) + 1;

  const { data, error } = await supabaseAdmin()
    .from("runs")
    .insert({
      objective: original.objective,
      status: "pending",
      priority: original.priority,
      // Reuse the exact same ICP the original attempt used (whether the
      // agent derived it or the user finalized it in the filter modal) so a
      // retry applies consistent criteria rather than re-deriving new ones.
      refined_icp: original.refined_icp,
      retry_of_run_id: rootId,
      attempt_number: nextAttempt,
      lead_count_target: original.lead_count_target,
      max_companies_searched: original.max_companies_searched,
      max_websites_scraped: original.max_websites_scraped,
      max_agent_turns: original.max_agent_turns,
      max_tool_calls: original.max_tool_calls,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createRetryRun failed: ${error.message}`);
  return data as Run;
}

export async function getRun(runId: string): Promise<Run | null> {
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error) throw new Error(`getRun failed: ${error.message}`);
  return data as Run | null;
}

export async function listRuns(limit = 50): Promise<Run[]> {
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listRuns failed: ${error.message}`);
  return (data ?? []) as Run[];
}

export async function setRunStatus(
  runId: string,
  status: RunStatus,
  extra: { error_message?: string | null; error_summary?: string | null; started_at?: string; completed_at?: string } = {}
) {
  const { error } = await supabaseAdmin().from("runs").update({ status, ...extra }).eq("id", runId);
  if (error) throw new Error(`setRunStatus failed: ${error.message}`);
}

export async function askClarifyingQuestion(runId: string, question: string) {
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ status: "needs_clarification", clarification_question: question, clarification_answer: null })
    .eq("id", runId);
  if (error) throw new Error(`askClarifyingQuestion failed: ${error.message}`);
}

// Persists the human's answer and moves the run back to refining_icp --
// the only stage ask_clarifying_question is allowed to be called from (see
// the icp-refinement skill and the ctx.icpSaved gate in tools.ts).
export async function answerClarifyingQuestion(runId: string, answer: string) {
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ status: "refining_icp", clarification_answer: answer })
    .eq("id", runId);
  if (error) throw new Error(`answerClarifyingQuestion failed: ${error.message}`);
}

export async function saveRefinedIcp(runId: string, icp: IcpCriteria) {
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ refined_icp: icp, status: "discovering" })
    .eq("id", runId);
  if (error) throw new Error(`saveRefinedIcp failed: ${error.message}`);
}

export async function getLeadsForRun(runId: string): Promise<Lead[]> {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getLeadsForRun failed: ${error.message}`);
  return (data ?? []) as Lead[];
}

export async function getToolCallsForRun(runId: string): Promise<ToolCall[]> {
  const { data, error } = await supabaseAdmin()
    .from("tool_calls")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getToolCallsForRun failed: ${error.message}`);
  return (data ?? []) as ToolCall[];
}

export async function countDistinctDiscoveredDomains(runId: string): Promise<number> {
  // Discovery results aren't stored as their own rows (they're transient
  // search hits) -- the real spend/limit signal is how many discover_companies
  // tool calls have run, which logToolCall already tracks. This counts leads
  // that exist so far as a proxy for "companies we've actually looked at".
  const { count, error } = await supabaseAdmin()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  if (error) throw new Error(`countDistinctDiscoveredDomains failed: ${error.message}`);
  return count ?? 0;
}

export async function upsertLeadQualification(
  runId: string,
  lead: {
    company_name: string;
    company_domain: string;
    company_email?: string | null;
    company_linkedin_url?: string | null;
    qualification_status: QualificationStatus;
    confidence: number;
    fit_reasons: string[];
    concerns: string[];
    source_urls: string[];
    source_summary: string;
    discovery_query?: string | null;
  }
): Promise<Lead> {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .upsert(
      {
        run_id: runId,
        company_name: lead.company_name,
        company_domain: lead.company_domain,
        company_email: lead.company_email ?? null,
        company_linkedin_url: lead.company_linkedin_url ?? null,
        qualification_status: lead.qualification_status,
        confidence: lead.confidence,
        fit_reasons: lead.fit_reasons,
        concerns: lead.concerns,
        source_urls: lead.source_urls,
        source_summary: lead.source_summary,
        discovery_query: lead.discovery_query ?? null,
      },
      { onConflict: "run_id,company_domain" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`upsertLeadQualification failed: ${error.message}`);
  await syncRunCounters(runId);
  return data as Lead;
}

// Used by save_lead_qualification to check whether a qualification call is a
// net-new qualified lead (counts against lead_count_target) or a re-save/
// correction of a company already qualified in this run (doesn't).
export async function getLeadByDomain(runId: string, domain: string): Promise<Lead | null> {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .eq("run_id", runId)
    .eq("company_domain", domain)
    .maybeSingle();
  if (error) throw new Error(`getLeadByDomain failed: ${error.message}`);
  return data as Lead | null;
}

export async function getLead(leadId: string): Promise<Lead | null> {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`getLead failed: ${error.message}`);
  return data as Lead | null;
}

export async function saveOutreachDraft(
  leadId: string,
  emailSequence: OutreachEmailStep[],
  linkedinMessage: string | null
): Promise<Lead> {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .update({
      outreach_email_sequence: emailSequence,
      outreach_linkedin_message: linkedinMessage,
    })
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) throw new Error(`saveOutreachDraft failed: ${error.message}`);
  return data as Lead;
}

export type OutreachPieceUpdate =
  | {
      type: "email";
      step: 1 | 2 | 3;
      subject: string;
      body: string;
      personalization_note: string;
      source: "manual" | "regenerated";
    }
  | { type: "linkedin"; message: string; source: "manual" | "regenerated" };

async function logOutreachEdit(
  runId: string,
  leadId: string,
  field: OutreachField,
  source: "manual" | "regenerated",
  previousValue: OutreachEditValue | null,
  newValue: OutreachEditValue
) {
  const { error } = await supabaseAdmin().from("outreach_edits").insert({
    run_id: runId,
    lead_id: leadId,
    field,
    source,
    previous_value: previousValue,
    new_value: newValue,
  });
  if (error) throw new Error(`logOutreachEdit failed: ${error.message}`);
}

/**
 * Persists an edit or an accepted regeneration for exactly one outreach
 * piece (one email step, or the LinkedIn message) without touching the
 * others. `source: "manual"` stamps an edited_at timestamp; `source:
 * "regenerated"` clears it, since the content is fresh agent output again,
 * not something a human hand-edited. Every call also appends a row to
 * outreach_edits with the before/after content -- leads/outreach_* only ever
 * hold the current version, so this is the only place prior versions survive.
 */
export async function updateOutreachPiece(leadId: string, update: OutreachPieceUpdate): Promise<Lead> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error(`updateOutreachPiece: lead ${leadId} not found`);

  if (update.type === "email") {
    const editedAt = update.source === "manual" ? new Date().toISOString() : null;
    const previousStep = lead.outreach_email_sequence.find((s) => s.step === update.step);
    const sequence = lead.outreach_email_sequence.map((s) =>
      s.step === update.step
        ? {
            step: update.step,
            subject: update.subject,
            body: update.body,
            personalization_note: update.personalization_note,
            edited_at: editedAt,
          }
        : s
    );
    const { data, error } = await supabaseAdmin()
      .from("leads")
      .update({ outreach_email_sequence: sequence })
      .eq("id", leadId)
      .select("*")
      .single();
    if (error) throw new Error(`updateOutreachPiece failed: ${error.message}`);

    await logOutreachEdit(
      lead.run_id,
      leadId,
      `email_${update.step}` as OutreachField,
      update.source,
      previousStep
        ? { subject: previousStep.subject, body: previousStep.body, personalization_note: previousStep.personalization_note }
        : null,
      { subject: update.subject, body: update.body, personalization_note: update.personalization_note }
    );

    return data as Lead;
  }

  const editedAt = update.source === "manual" ? new Date().toISOString() : null;
  const previousMessage = lead.outreach_linkedin_message;
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .update({ outreach_linkedin_message: update.message, outreach_linkedin_edited_at: editedAt })
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw new Error(`updateOutreachPiece failed: ${error.message}`);

  await logOutreachEdit(
    lead.run_id,
    leadId,
    "linkedin",
    update.source,
    previousMessage ? { message: previousMessage } : null,
    { message: update.message }
  );

  return data as Lead;
}

export async function getOutreachEditsForRun(runId: string): Promise<OutreachEdit[]> {
  const { data, error } = await supabaseAdmin()
    .from("outreach_edits")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getOutreachEditsForRun failed: ${error.message}`);
  return (data ?? []) as OutreachEdit[];
}

export async function syncRunCounters(runId: string) {
  const leads = await getLeadsForRun(runId);
  const qualified_count = leads.filter((l) => l.qualification_status === "qualified").length;
  const not_qualified_count = leads.filter((l) => l.qualification_status === "not_qualified").length;
  const needs_review_count = leads.filter((l) => l.qualification_status === "needs_review").length;

  // Note: companies_discovered_count is NOT derived from leads.length here.
  // It must reflect how many distinct candidates discover_companies actually
  // returned from Apify (up to max_companies_searched), which can be larger
  // than the number of leads the agent chose to scrape/qualify -- see
  // setCompaniesDiscoveredCount, called directly from the discover_companies
  // tool instead.
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ qualified_count, not_qualified_count, needs_review_count })
    .eq("id", runId);

  if (error) throw new Error(`syncRunCounters failed: ${error.message}`);
}

export async function setCompaniesDiscoveredCount(runId: string, count: number) {
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ companies_discovered_count: count })
    .eq("id", runId);
  if (error) throw new Error(`setCompaniesDiscoveredCount failed: ${error.message}`);
}

export async function incrementWebsitesScrapedCount(runId: string) {
  const run = await getRun(runId);
  if (!run) return;
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ websites_scraped_count: run.websites_scraped_count + 1 })
    .eq("id", runId);
  if (error) throw new Error(`incrementWebsitesScrapedCount failed: ${error.message}`);
}

export async function addApifyCost(runId: string, costUsd: number) {
  if (!costUsd) return;
  const run = await getRun(runId);
  if (!run) return;
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ estimated_apify_cost_usd: Number(run.estimated_apify_cost_usd) + costUsd })
    .eq("id", runId);
  if (error) throw new Error(`addApifyCost failed: ${error.message}`);
}

// total_cost_usd on the SDK result message is already cumulative for the
// whole query() call, so this sets rather than adds. Deliberately swallows
// its own errors (e.g. the column not existing yet on an un-migrated
// database) instead of throwing -- this is informational cost tracking and
// must never be able to fail the run it's attached to.
export async function setClaudeCost(runId: string, totalCostUsd: number) {
  const { error } = await supabaseAdmin()
    .from("runs")
    .update({ estimated_claude_cost_usd: totalCostUsd })
    .eq("id", runId);
  if (error) console.error(`setClaudeCost failed (non-fatal): ${error.message}`);
}

export interface SimilarRun {
  id: string;
  objective: string;
  created_at: string;
  status: RunStatus;
  qualified_count: number;
  lead_count_target: number;
  similarity: number;
}

// Used by the "New run" form to warn before starting a near-duplicate --
// scans recent objectives with a cheap word-overlap check, not an LLM call,
// since this needs to be fast on every submission attempt.
export async function findSimilarRuns(objective: string, threshold = 0.5): Promise<SimilarRun[]> {
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("id, objective, created_at, status, qualified_count, lead_count_target")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`findSimilarRuns failed: ${error.message}`);

  return (data ?? [])
    .map((r) => ({ ...r, similarity: objectiveSimilarity(objective, r.objective) }))
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5) as SimilarRun[];
}

// Used by the sidebar's error-log badge -- a lightweight count only, not the
// full rows, so it's cheap to poll. "since" compares against completed_at
// for runs (when they actually became an error/shortfall, not when they were
// created) and created_at for tool_calls (created once, never updated).
export async function getErrorCountSince(since: string): Promise<number> {
  const [failed, shortfall, toolCalls] = await Promise.all([
    supabaseAdmin().from("runs").select("id", { count: "exact", head: true }).eq("status", "failed").gt("completed_at", since),
    supabaseAdmin()
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .not("error_message", "is", null)
      .gt("completed_at", since),
    supabaseAdmin().from("tool_calls").select("id", { count: "exact", head: true }).eq("status", "error").gt("created_at", since),
  ]);
  if (failed.error) throw new Error(`getErrorCountSince (failed runs) failed: ${failed.error.message}`);
  if (shortfall.error) throw new Error(`getErrorCountSince (shortfall runs) failed: ${shortfall.error.message}`);
  if (toolCalls.error) throw new Error(`getErrorCountSince (tool call errors) failed: ${toolCalls.error.message}`);
  return (failed.count ?? 0) + (shortfall.count ?? 0) + (toolCalls.count ?? 0);
}

export async function getFailedRuns(limit = 50): Promise<Run[]> {
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("*")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getFailedRuns failed: ${error.message}`);
  return (data ?? []) as Run[];
}

// Runs that finished "completed" but short of their qualified-leads target,
// with the required explanation from update_run_status -- distinct from
// genuinely failed runs, but still something a reviewer wants surfaced.
export async function getShortfallRuns(limit = 50): Promise<Run[]> {
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("*")
    .eq("status", "completed")
    .not("error_message", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getShortfallRuns failed: ${error.message}`);
  return (data ?? []) as Run[];
}

export interface ErrorToolCallEntry extends ToolCall {
  run_objective: string;
}

export async function getErrorToolCalls(limit = 100): Promise<ErrorToolCallEntry[]> {
  const { data, error } = await supabaseAdmin()
    .from("tool_calls")
    .select("*")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getErrorToolCalls failed: ${error.message}`);
  const calls = (data ?? []) as ToolCall[];
  if (calls.length === 0) return [];

  // Looked up as a second query rather than a PostgREST embed (tool_calls ->
  // runs) to avoid depending on how the FK relationship gets inferred --
  // simple and robust for what's a handful of ids per page load.
  const runIds = Array.from(new Set(calls.map((c) => c.run_id)));
  const { data: runs, error: runsError } = await supabaseAdmin()
    .from("runs")
    .select("id, objective")
    .in("id", runIds);
  if (runsError) throw new Error(`getErrorToolCalls (run lookup) failed: ${runsError.message}`);
  const objectiveById = new Map((runs ?? []).map((r) => [r.id as string, r.objective as string]));

  return calls.map((c) => ({ ...c, run_objective: objectiveById.get(c.run_id) ?? "(unknown run)" }));
}

export async function logToolCall(entry: {
  run_id: string;
  lead_id?: string | null;
  tool_name: string;
  purpose?: string | null;
  input_summary?: string | null;
  result_summary?: string | null;
  status: "success" | "error";
  error_message?: string | null;
  cost_usd?: number | null;
  duration_ms?: number | null;
}) {
  const { error } = await supabaseAdmin().from("tool_calls").insert({
    run_id: entry.run_id,
    lead_id: entry.lead_id ?? null,
    tool_name: entry.tool_name,
    purpose: entry.purpose ?? null,
    input_summary: entry.input_summary ?? null,
    result_summary: entry.result_summary ?? null,
    status: entry.status,
    error_message: entry.error_message ?? null,
    cost_usd: entry.cost_usd ?? null,
    duration_ms: entry.duration_ms ?? null,
  });
  if (error) throw new Error(`logToolCall failed: ${error.message}`);
}

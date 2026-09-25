-- Koya Talent AI Lead Research & Outreach Agent
-- Supabase schema
--
-- Run this whole file once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- on a fresh project. It is safe to re-run on an empty schema; it is NOT idempotent
-- against partially-created tables (drop the three tables first if you need to
-- re-run after a partial failure).
--
-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY: intentionally left OFF on all three tables.
--
-- Why: this is a single-user internal tool. The web app talks to Supabase
-- exclusively from server-side code (Next.js API routes / server actions)
-- using the SERVICE ROLE key, which bypasses RLS entirely anyway and is never
-- exposed to the browser. No anon/public client ever queries these tables
-- directly, so table-level RLS policies would add complexity without adding
-- a real security boundary here. Access control for this tool is enforced at
-- the application layer (the server), not at the Postgres layer.
--
-- If this app is ever extended to let the browser query Supabase directly
-- (e.g. with the anon key, or multiple users), RLS MUST be enabled at that
-- point with policies scoped to the authenticated user.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- runs: one row per qualification objective submitted by the user.
-- ---------------------------------------------------------------------------

create table if not exists runs (
  id                          uuid primary key default gen_random_uuid(),
  objective                   text not null,
  refined_icp                 jsonb,

  -- Always points at the ORIGINAL run in a retry chain (never an
  -- intermediate retry), even if this run is itself a retry of a retry --
  -- flattening it this way makes "every run in this family" a simple
  -- (id = root or retry_of_run_id = root) query instead of a recursive one.
  retry_of_run_id             uuid references runs (id) on delete set null,
  attempt_number              integer not null default 1,

  lead_count_target           integer not null default 10,
  max_companies_searched      integer not null default 40,
  max_websites_scraped        integer not null default 25,
  max_agent_turns             integer not null default 60,
  max_tool_calls              integer not null default 150,
  priority                    text not null default 'balanced'
                                check (priority in (
                                  'balanced', 'qualified_leads', 'companies_discovered',
                                  'websites_scraped', 'agent_turns', 'tool_calls'
                                )),

  status                      text not null default 'pending'
                                check (status in (
                                  'pending', 'refining_icp', 'discovering',
                                  'scraping', 'qualifying', 'drafting',
                                  'needs_clarification',
                                  'completed', 'failed'
                                )),

  clarification_question      text,
  clarification_answer        text,

  companies_discovered_count  integer not null default 0,
  websites_scraped_count      integer not null default 0,
  qualified_count             integer not null default 0,
  not_qualified_count         integer not null default 0,
  needs_review_count          integer not null default 0,

  estimated_apify_cost_usd    numeric(10,4) not null default 0,
  estimated_claude_cost_usd   numeric(10,4) not null default 0,

  error_message               text,
  error_summary               text,

  started_at                  timestamptz,
  completed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on table runs is
  'One row per lead-qualification objective submitted by the user. Holds the original objective, the agent-refined ICP, and the hard tool-usage limits the agent must operate within for this run.';
comment on column runs.objective is
  'Verbatim qualification objective text as typed by the user, before ICP refinement.';
comment on column runs.refined_icp is
  'Structured ICP object produced by the icp-refinement skill. Shape: { target_company_type, industries, geography, headcount_range, buyer_persona, business_problem, hard_filters, soft_preferences, disqualifiers } per assets/icp-refinement-guide.md.';
comment on column runs.retry_of_run_id is
  'Set when this run is a retry of an earlier one (same objective/limits, re-run to get more leads) -- always points at the original run in the chain, never an intermediate retry. Null for an original, non-retry run.';
comment on column runs.attempt_number is
  '1 for an original run; 2, 3, ... for each successive retry of it. Purely for display (e.g. an "Attempt 2" badge) and CSV export grouping.';
comment on column runs.lead_count_target is
  'Number of qualified leads the run is aiming for (e.g. 10). Set by the application when the run is created, not chosen by the agent.';
comment on column runs.max_companies_searched is
  'Hard cap on distinct candidate companies the discovery tool may return across the whole run. Enforced in the discovery tool implementation, independent of agent requests.';
comment on column runs.max_websites_scraped is
  'Hard cap on the number of website-scrape tool calls allowed for this run.';
comment on column runs.max_agent_turns is
  'Hard cap on Claude Agent SDK conversation turns for this run, to bound runaway loops.';
comment on column runs.priority is
  '"balanced" runs with the five limit columns exactly as set. Any other value names which one is this run''s real goal -- that column keeps its entered value, and the other four are expanded (still to a fixed, finite number -- see src/lib/limits.ts) to give the agent more room to reach it. Computed once by the application before the run starts; the agent never adjusts its own budget.';
comment on column runs.max_tool_calls is
  'Hard cap on total tool invocations (discovery + scraping + qualification + drafting + run/lead writes) for this run.';
comment on column runs.clarification_question is
  'Set by the ask_clarifying_question tool when the agent judges the objective too ambiguous to build a meaningful ICP from before searching. Paired with status = needs_clarification; cleared (left as the last-asked question) once answered.';
comment on column runs.clarification_answer is
  'Human answer to clarification_question, submitted via POST /api/runs/[id]/clarify. Null while status = needs_clarification.';
comment on column runs.qualified_count is
  'Denormalized count of leads with qualification_status = qualified for this run. Excludes needs_review by definition -- kept in sync by the application after each lead write.';
comment on column runs.needs_review_count is
  'Denormalized count of leads marked needs_review. These are never included in qualified_count and must not be reported to the user as qualified leads.';
comment on column runs.estimated_apify_cost_usd is
  'Running total of Apify pay-per-event spend attributed to this run, summed from tool_calls.cost_usd for Apify tool calls. Informational only -- authoritative cost lives in the Apify Console.';
comment on column runs.estimated_claude_cost_usd is
  'Cumulative estimated Claude API cost in USD for this run''s main agent query() call, as reported on the SDK result message (total_cost_usd). An estimate, not a billing statement; excludes any regenerate_outreach calls made afterward from the lead detail view.';
comment on column runs.error_message is
  'The full explanation for a failed run, or for a completed run that finished short of its qualified-leads target -- can be a long narrative. Null otherwise. See error_summary for the one-line version most people should actually see.';
comment on column runs.error_summary is
  'A single business-friendly sentence covering the same failure/shortfall as error_message (e.g. "Discovery budget exhausted after 40 companies -- 4 of 10 qualified"). Required alongside error_message by update_run_status -- see tools.ts. Null for older rows written before this column existed; the UI falls back to truncating error_message for those.';

create index if not exists idx_runs_status on runs (status);

-- ---------------------------------------------------------------------------
-- leads: one row per candidate company evaluated within a run.
-- ---------------------------------------------------------------------------

create table if not exists leads (
  id                          uuid primary key default gen_random_uuid(),
  run_id                      uuid not null references runs (id) on delete cascade,

  company_name                text not null,
  company_domain              text not null,
  company_email                text,
  company_linkedin_url         text,

  qualification_status        text not null
                                check (qualification_status in (
                                  'qualified', 'not_qualified', 'needs_review'
                                )),
  confidence                  numeric(3,2)
                                check (confidence >= 0 and confidence <= 1),

  fit_reasons                 jsonb not null default '[]'::jsonb,
  concerns                    jsonb not null default '[]'::jsonb,
  source_urls                 jsonb not null default '[]'::jsonb,
  source_summary              text,

  discovery_query             text,

  outreach_email_sequence     jsonb not null default '[]'::jsonb,
  outreach_linkedin_message   text,
  outreach_linkedin_edited_at timestamptz,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  unique (run_id, company_domain)
);

comment on table leads is
  'One row per candidate company evaluated within a run, with its qualification decision, evidence, and (if qualified) drafted outreach copy. Outreach fields are drafts for human review only -- there is no send path.';
comment on column leads.company_email is
  'General company contact email if found (e.g. info@, contact@, hello@) -- never a named individual''s address. Structurally validated at the tool layer to only accept generic/departmental local-parts; this is public business contact info, not the personal-email discovery this system is forbidden from doing.';
comment on column leads.company_linkedin_url is
  'The company''s own LinkedIn page (linkedin.com/company/...) if found -- never a personal profile (linkedin.com/in/...), which the tool layer rejects.';
comment on column leads.qualification_status is
  'qualified | not_qualified | needs_review, per assets/lead-qualification-guide.md. needs_review means evidence was incomplete or mixed, not a qualified lead.';
comment on column leads.confidence is
  'Agent-reported confidence in the qualification decision, 0.0-1.0.';
comment on column leads.fit_reasons is
  'JSON array of plain-language reasons the company fits the ICP, grounded in source_urls/source_summary.';
comment on column leads.concerns is
  'JSON array of plain-language concerns or gaps found during qualification.';
comment on column leads.source_urls is
  'JSON array of URLs (company site pages) that were scraped and used as evidence for this decision.';
comment on column leads.source_summary is
  'Plain-language summary of the scraped website content used as evidence. Scraped content itself is untrusted input and is never executed as instructions; this column stores the agent''s summary of it, not raw page content.';
comment on column leads.discovery_query is
  'The Apify discovery search query that surfaced this company, for traceability back to the discovery tool call.';
comment on column leads.outreach_email_sequence is
  'JSON array of up to 3 objects: { step, subject, body, personalization_note }, per assets/outbound-copywriting-guide.md. Drafts only -- never sent by this application.';
comment on column leads.outreach_linkedin_message is
  'Optional short LinkedIn message draft. Draft only -- never sent by this application.';
comment on column leads.outreach_linkedin_edited_at is
  'Set when a human manually edits the LinkedIn draft in the UI; null means it is exactly what the agent (originally or on a kept regeneration) produced. outreach_email_sequence carries the equivalent per-step edited_at inside its own JSON.';

create index if not exists idx_leads_run_id on leads (run_id);
create index if not exists idx_leads_qualification_status on leads (qualification_status);

-- ---------------------------------------------------------------------------
-- outreach_edits: append-only history of edits/regenerations applied to a
-- lead's outreach drafts. leads/outreach_email_sequence and
-- outreach_linkedin_message only ever hold the CURRENT content -- this table
-- is what makes prior versions visible.
-- ---------------------------------------------------------------------------

create table if not exists outreach_edits (
  id                          uuid primary key default gen_random_uuid(),
  run_id                      uuid not null references runs (id) on delete cascade,
  lead_id                     uuid not null references leads (id) on delete cascade,

  field                       text not null check (field in ('email_1', 'email_2', 'email_3', 'linkedin')),
  source                      text not null check (source in ('manual', 'regenerated')),

  previous_value              jsonb,
  new_value                   jsonb not null,

  created_at                  timestamptz not null default now()
);

comment on table outreach_edits is
  'Append-only history of every manual edit or accepted regeneration applied to a lead''s outreach draft (one email step, or the LinkedIn message) -- lets a reviewer see what changed, when, and by which path.';
comment on column outreach_edits.field is
  'Which piece of outreach this edit applied to: email_1/email_2/email_3 (the 3-step sequence) or linkedin.';
comment on column outreach_edits.source is
  'manual = a human hand-edited it in the UI; regenerated = an agent regeneration was kept, replacing the prior content.';
comment on column outreach_edits.previous_value is
  'The piece''s content before this edit -- {subject, body, personalization_note} for an email step, {message} for linkedin. Null if there was no prior draft.';
comment on column outreach_edits.new_value is
  'The piece''s content after this edit, same shape as previous_value.';

create index if not exists idx_outreach_edits_run_id on outreach_edits (run_id);
create index if not exists idx_outreach_edits_lead_id on outreach_edits (lead_id);

-- ---------------------------------------------------------------------------
-- tool_calls: append-only audit log of every tool invocation made during a run.
-- ---------------------------------------------------------------------------

create table if not exists tool_calls (
  id                          uuid primary key default gen_random_uuid(),
  run_id                      uuid not null references runs (id) on delete cascade,
  lead_id                     uuid references leads (id) on delete cascade,

  tool_name                   text not null,
  purpose                     text,
  input_summary               text,
  result_summary              text,

  status                      text not null check (status in ('success', 'error')),
  error_message                text,

  cost_usd                    numeric(10,4),
  duration_ms                 integer,

  created_at                  timestamptz not null default now()
);

comment on table tool_calls is
  'Append-only log of every tool call the agent makes during a run (discovery, scraping, qualification writes, outreach writes, run/lead updates). This is the primary evidence trail for reviewing agent behavior and tool-limit compliance.';
comment on column tool_calls.lead_id is
  'Set when the tool call relates to a specific company (e.g. scrape, qualify, draft). Null for run-level calls such as discovery or ICP refinement.';
comment on column tool_calls.purpose is
  'Short human-readable description of why the agent made this call, e.g. "discover candidate SaaS companies in Texas".';
comment on column tool_calls.input_summary is
  'Human-readable summary of the tool input (e.g. the search query, or the URL scraped). Not necessarily the full raw payload.';
comment on column tool_calls.result_summary is
  'Human-readable summary of the tool result (e.g. "12 candidates found", "scraped 3,400 chars"). Not necessarily the full raw payload.';
comment on column tool_calls.cost_usd is
  'Reported or estimated cost of this call in USD, populated for billed calls (Apify pay-per-event, Firecrawl). Null when not applicable/known.';

create index if not exists idx_tool_calls_run_id on tool_calls (run_id);
create index if not exists idx_tool_calls_lead_id on tool_calls (lead_id);

-- ---------------------------------------------------------------------------
-- updated_at housekeeping
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_runs_updated_at on runs;
create trigger trg_runs_updated_at
  before update on runs
  for each row execute function set_updated_at();

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

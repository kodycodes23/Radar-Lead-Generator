// Shared types. Field names on IcpCriteria and LeadQualification mirror the
// JSON schemas in assets/icp-refinement-guide.md and
// assets/lead-qualification-guide.md exactly -- do not rename fields here
// without updating those guides/skills too.

export type RunStatus =
  | "pending"
  | "refining_icp"
  | "discovering"
  | "scraping"
  | "qualifying"
  | "drafting"
  | "needs_clarification"
  | "completed"
  | "failed";

// Shared with every place that polls run status (run detail page, sidebar,
// runs list) so "is this run still going" is defined in exactly one place.
// needs_clarification is included -- the run is paused waiting on a human
// answer, not finished, so it must keep polling until it resumes.
export const ACTIVE_RUN_STATUSES: RunStatus[] = [
  "pending",
  "refining_icp",
  "discovering",
  "scraping",
  "qualifying",
  "drafting",
  "needs_clarification",
];

export interface RunLimits {
  lead_count_target: number;
  max_companies_searched: number;
  max_websites_scraped: number;
  max_agent_turns: number;
  max_tool_calls: number;
}

export const DEFAULT_RUN_LIMITS: RunLimits = {
  lead_count_target: 10,
  max_companies_searched: 40,
  // Deliberately well above max_companies_searched, not matched 1:1: real
  // evidence from one full run showed ~2.3 scrapes needed per candidate just
  // to confirm the qualification hard filters (most sites need 2-3 page
  // visits), plus the lead-qualification skill now requires one more scrape
  // for every qualified/needs_review candidate specifically to find contact
  // info -- a matched-1:1 cap (40) was fully used and still only reached 17
  // of 40 discovered candidates. max_tool_calls (150) already has headroom
  // to absorb this (that same run only used 81 of 150).
  max_websites_scraped: 70,
  // Matches max_tool_calls: real evidence (two runs) showed turns and tool
  // calls consumed at roughly a 1:1 ratio, and turns ran out first even
  // though tool-call usage was nowhere near its own cap -- see limits.ts.
  max_agent_turns: 150,
  max_tool_calls: 150,
};

// "balanced" = your numbers, taken exactly as entered (today's behavior).
// Any other value picks which RunLimits field is the run's real goal --
// that field keeps your exact number, and the other four are expanded (see
// computeEffectiveLimits in limits.ts) to give the agent real room to reach
// it. Every dimension, expanded or not, is still a fixed, finite cap set
// before the run starts -- never agent-decided, never truly uncapped.
export type RunPriority =
  | "balanced"
  | "qualified_leads"
  | "companies_discovered"
  | "websites_scraped"
  | "agent_turns"
  | "tool_calls";

export const RUN_PRIORITY_FIELD: Record<RunPriority, keyof RunLimits | null> = {
  balanced: null,
  qualified_leads: "lead_count_target",
  companies_discovered: "max_companies_searched",
  websites_scraped: "max_websites_scraped",
  agent_turns: "max_agent_turns",
  tool_calls: "max_tool_calls",
};

export const RUN_PRIORITY_OPTIONS: { value: RunPriority; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "qualified_leads", label: "Qualified leads target" },
  { value: "companies_discovered", label: "Max companies discovered" },
  { value: "websites_scraped", label: "Max websites scraped" },
  { value: "agent_turns", label: "Max agent turns" },
  { value: "tool_calls", label: "Max tool calls" },
];

export interface IcpCriteria {
  target_company_type: string;
  industries: string[];
  geography: string[];
  headcount_range: string;
  buyer_persona: string;
  business_problem: string;
  hard_filters: string[];
  soft_preferences: string[];
  disqualifiers: string[];
}

export type QualificationStatus = "qualified" | "not_qualified" | "needs_review";

export interface OutreachEmailStep {
  step: number;
  subject: string;
  body: string;
  personalization_note: string;
  // Set when a human last manually edited this step; null means the content
  // is exactly as the agent (originally or on a kept regeneration) produced.
  edited_at?: string | null;
}

export interface Run extends RunLimits {
  id: string;
  objective: string;
  refined_icp: IcpCriteria | null;
  // retry_of_run_id always points at the ORIGINAL run in a retry chain, even
  // for a retry-of-a-retry -- see schema.sql for why it's flattened this way.
  retry_of_run_id: string | null;
  attempt_number: number;
  priority: RunPriority;
  status: RunStatus;
  clarification_question: string | null;
  clarification_answer: string | null;
  companies_discovered_count: number;
  websites_scraped_count: number;
  qualified_count: number;
  not_qualified_count: number;
  needs_review_count: number;
  estimated_apify_cost_usd: number;
  estimated_claude_cost_usd: number;
  error_message: string | null;
  // One-line, business-friendly version of error_message -- what most
  // people should actually see; error_message is the full explanation for
  // whoever wants to read it. Null for rows written before this existed.
  error_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  run_id: string;
  company_name: string;
  company_domain: string;
  // General company contact info only (e.g. info@company.com,
  // linkedin.com/company/...) -- never a named individual's, enforced at the
  // tool layer, not just by prompting. See save_lead_qualification in tools.ts.
  company_email: string | null;
  company_linkedin_url: string | null;
  qualification_status: QualificationStatus;
  confidence: number | null;
  fit_reasons: string[];
  concerns: string[];
  source_urls: string[];
  source_summary: string | null;
  discovery_query: string | null;
  outreach_email_sequence: OutreachEmailStep[];
  outreach_linkedin_message: string | null;
  // Set when a human last manually edited the LinkedIn message; null means
  // it's exactly as the agent (originally or on a kept regeneration) produced.
  outreach_linkedin_edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  id: string;
  run_id: string;
  lead_id: string | null;
  tool_name: string;
  purpose: string | null;
  input_summary: string | null;
  result_summary: string | null;
  status: "success" | "error";
  error_message: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  created_at: string;
}

export type OutreachField = "email_1" | "email_2" | "email_3" | "linkedin";

// Shape varies by field: {subject, body, personalization_note} for an email
// step, {message} for linkedin -- never both, per which `field` this belongs to.
export interface OutreachEditValue {
  subject?: string;
  body?: string;
  personalization_note?: string;
  message?: string;
}

export interface OutreachEdit {
  id: string;
  run_id: string;
  lead_id: string;
  field: OutreachField;
  source: "manual" | "regenerated";
  previous_value: OutreachEditValue | null;
  new_value: OutreachEditValue;
  created_at: string;
}

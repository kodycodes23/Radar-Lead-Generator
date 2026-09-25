import { RUN_PRIORITY_FIELD, type RunLimits, type RunPriority } from "./types";

// How much the non-priority dimensions expand by when a priority is chosen.
const EXPANSION_FACTOR = 3;

// Absolute ceilings, independent of the expansion factor or whatever base
// number the user entered. This is what makes "priority" mode safe: no
// matter how the multiplication works out, no dimension can ever exceed
// these -- there is always a finite, hard stop. See
// aat-c3-week-5-lead-agent/PRD.md "Apify Usage Limits": "Never start an
// actor with an uncapped input."
const ABSOLUTE_CEILINGS: RunLimits = {
  lead_count_target: 50,
  max_companies_searched: 150,
  // Matches max_companies_searched's ceiling so "scrape everything
  // discovered" holds under priority-mode expansion too, not just at the
  // balanced default -- see DEFAULT_RUN_LIMITS in types.ts.
  max_websites_scraped: 150,
  // Matches max_tool_calls' ceiling: two real runs hit the OLD turns ceiling
  // (150) with tool-call usage nowhere near its own ceiling (450) -- turns
  // were consumed at roughly a 1:1 ratio with tool calls (49 tool calls for
  // ~60 turns exhausted; 45 for ~60), meaning turns was the actual bottleneck
  // stopping a finished pipeline, not tool calls. Raised to track
  // max_tool_calls rather than an arbitrary guess.
  max_agent_turns: 450,
  max_tool_calls: 450,
};

/**
 * Computes the actual limits a run will operate under, given the user's
 * base numbers and their chosen priority. "balanced" returns the base
 * numbers unchanged. Any other priority keeps that one field exactly as
 * entered (it's the run's real goal) and expands the rest by
 * EXPANSION_FACTOR, each still clamped to its own absolute ceiling.
 */
export function computeEffectiveLimits(base: RunLimits, priority: RunPriority): RunLimits {
  const priorityField = RUN_PRIORITY_FIELD[priority];
  if (!priorityField) return { ...base };

  const result = { ...base };
  for (const key of Object.keys(result) as (keyof RunLimits)[]) {
    if (key === priorityField) continue;
    result[key] = Math.min(Math.round(base[key] * EXPANSION_FACTOR), ABSOLUTE_CEILINGS[key]);
  }
  return result;
}

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getRun, setRunStatus, setClaudeCost, getKnownDomainsForRunFamily } from "@/lib/db";
import type { RunLimits } from "@/lib/types";
import { buildSystemPrompt } from "./systemPrompt";
import { buildToolServer, LEADGEN_ALLOWED_TOOLS, type RunContext } from "./tools";

// If the agent loop goes this long without producing a single new message
// (any message -- not just a tool call), something is genuinely hung, not
// just slow. Real evidence: a run sat completely silent for 66+ minutes
// after its last successful tool call, with no error, no timeout, and
// nothing to catch it -- it just sat in "discovering" forever. This aborts
// the underlying query() call so the run fails loudly instead of hanging
// forever. Generous on purpose: real turns (an LLM call plus a slow scrape)
// can legitimately take a couple of minutes.
const WATCHDOG_TIMEOUT_MS = 6 * 60 * 1000;

/**
 * Runs the full agent loop for one run to completion. This is a long-running
 * async function (a full 10-lead run can easily take several minutes) --
 * callers should fire this and not await it inside a request handler. It
 * relies on the host process staying alive for the run's duration (true for
 * `next dev`/`next start` and for a persistent host like Render/Railway; NOT
 * true for a request-scoped serverless function, which would freeze the
 * process before this finishes).
 */
export async function runAgent(runId: string): Promise<void> {
  const run = await getRun(runId);
  if (!run) throw new Error(`runAgent: run ${runId} not found`);

  const limits: RunLimits = {
    lead_count_target: run.lead_count_target,
    max_companies_searched: run.max_companies_searched,
    max_websites_scraped: run.max_websites_scraped,
    max_agent_turns: run.max_agent_turns,
    max_tool_calls: run.max_tool_calls,
  };

  const abortController = new AbortController();
  let watchdogFired = false;
  let watchdogPaused = false;
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  const resetWatchdog = () => {
    // A no-op while paused: some SDK message (e.g. a tool-progress event)
    // could otherwise land mid-wait and silently re-arm the timer, undoing
    // the pause ask_clarifying_question relies on while it blocks on a human.
    if (watchdogPaused) return;
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      watchdogFired = true;
      abortController.abort();
    }, WATCHDOG_TIMEOUT_MS);
  };

  // Empty for a non-retry run; for a retry, every domain already found by an
  // earlier attempt in the same family, so discovery never re-surfaces them.
  const knownDomains = await getKnownDomainsForRunFamily(runId);

  // Set when the user finalized the ICP themselves in the pre-run filter
  // modal (or this run inherited one from a retried attempt) -- the agent's
  // own icp-refinement judgment is skipped entirely for this run; see
  // save_refined_icp's icpSaved guard in tools.ts.
  const icpPreset = run.refined_icp !== null;

  const ctx: RunContext = {
    runId,
    limits,
    counters: { companiesDiscovered: 0, websitesScraped: 0, toolCalls: 0 },
    icpSaved: icpPreset,
    clarificationAsked: false,
    knownDomains,
    // The ask_clarifying_question tool blocks on a human response that can
    // legitimately take much longer than the silence watchdog's window --
    // pause it for that wait's duration instead of letting it abort the run
    // out from under a pending question, then resume once answered.
    watchdog: {
      pause: () => {
        watchdogPaused = true;
        clearTimeout(watchdogTimer);
      },
      resume: () => {
        watchdogPaused = false;
        resetWatchdog();
      },
    },
  };

  const server = buildToolServer(ctx);
  const systemPrompt = buildSystemPrompt(
    run.objective,
    limits,
    run.priority,
    { attemptNumber: run.attempt_number, knownDomainCount: knownDomains.size },
    icpPreset ? run.refined_icp : null
  );

  await setRunStatus(runId, icpPreset ? "discovering" : "refining_icp", { started_at: new Date().toISOString() });

  resetWatchdog();

  let sawResult = false;
  try {
    for await (const message of query({
      prompt: `Begin the run for qualification objective: "${run.objective}"`,
      options: {
        systemPrompt,
        cwd: process.cwd(),
        settingSources: ["project"],
        skills: "all",
        tools: ["Skill"],
        allowedTools: [...LEADGEN_ALLOWED_TOOLS, "Skill"],
        mcpServers: { leadgen: server },
        maxTurns: limits.max_agent_turns,
        permissionMode: "bypassPermissions",
        abortController,
      },
    })) {
      resetWatchdog(); // any message at all counts as progress
      if (message.type === "result") {
        sawResult = true;
        await setClaudeCost(runId, message.total_cost_usd);
        if (message.subtype !== "success") {
          await setRunStatus(runId, "failed", {
            error_message: `Agent loop ended with subtype "${message.subtype}".`,
            error_summary: `Run ended abnormally (${message.subtype}).`,
            completed_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    clearTimeout(watchdogTimer);
    const errorMessage = watchdogFired
      ? `Agent loop hung -- no activity for ${Math.round(WATCHDOG_TIMEOUT_MS / 60000)} minutes, aborted by the watchdog.`
      : e instanceof Error
        ? e.message
        : String(e);
    await setRunStatus(runId, "failed", {
      error_message: errorMessage,
      error_summary: watchdogFired
        ? `Run stalled -- no activity for ${Math.round(WATCHDOG_TIMEOUT_MS / 60000)} minutes.`
        : errorMessage.length > 140
          ? `${errorMessage.slice(0, 140).trimEnd()}…`
          : errorMessage,
      completed_at: new Date().toISOString(),
    });
    return;
  }
  clearTimeout(watchdogTimer);

  if (!sawResult) {
    await setRunStatus(runId, "failed", {
      error_message: "Agent loop ended without a result message.",
      error_summary: "Run ended without producing a result.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  // Safety net: if the agent never called update_run_status itself (e.g. it
  // ran out of turns mid-pipeline), don't leave the run stuck showing an
  // in-progress stage forever.
  const finalRun = await getRun(runId);
  if (finalRun && finalRun.status !== "completed" && finalRun.status !== "failed") {
    const hasQualified = finalRun.qualified_count > 0;
    const shortOfTarget = finalRun.qualified_count < finalRun.lead_count_target;
    await setRunStatus(runId, hasQualified ? "completed" : "failed", {
      error_message: !hasQualified
        ? "Agent ended the run without qualifying any leads or calling update_run_status."
        : shortOfTarget
          ? `Agent ended the run (without calling update_run_status itself) at ${finalRun.qualified_count}/${finalRun.lead_count_target} qualified -- likely ran out of turns/tool-call budget before finishing or explaining why.`
          : null,
      error_summary: !hasQualified
        ? "Ended without qualifying any leads."
        : shortOfTarget
          ? `Ran out of budget at ${finalRun.qualified_count}/${finalRun.lead_count_target} qualified.`
          : null,
      completed_at: new Date().toISOString(),
    });
  }
}

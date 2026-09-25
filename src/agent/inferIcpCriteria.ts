import { z } from "zod";
import type { IcpCriteria } from "@/lib/types";

const icpSchema = z.object({
  target_company_type: z.string(),
  industries: z.array(z.string()),
  geography: z.array(z.string()),
  headcount_range: z.string(),
  buyer_persona: z.string(),
  business_problem: z.string(),
  hard_filters: z.array(z.string()),
  soft_preferences: z.array(z.string()),
  disqualifiers: z.array(z.string()),
});

const SYSTEM_PROMPT =
  "You are helping a human reviewer set up a lead-qualification run, before any research starts. Your only " +
  "job is to propose a structured ICP breakdown for their objective.\n\n" +
  "Hard filters vs. soft preferences: a hard filter must be true for a lead to qualify; a soft preference " +
  "improves fit without automatically disqualifying. Classify each field by two tests -- (1) is it phrased as " +
  'non-negotiable ("must", "only", "exactly") vs. descriptive of a typical target; (2) is it a categorical fact ' +
  "a public website usually confirms (country, B2B/B2C, industry) vs. a precise number rarely stated anywhere " +
  "(exact headcount, revenue) that would mostly produce false negatives if forced hard. When genuinely unsure, " +
  "note your best-guess default inline in that field's own value as `(assumed: ...)` rather than leaving it " +
  "blank -- the human reviewing this in a UI right after can correct it.";

const ICP_TOOL = {
  name: "submit_icp_suggestion",
  description: "Submit your suggested ICP breakdown for this objective.",
  input_schema: {
    type: "object" as const,
    properties: {
      target_company_type: { type: "string" },
      industries: { type: "array", items: { type: "string" } },
      geography: { type: "array", items: { type: "string" } },
      headcount_range: { type: "string" },
      buyer_persona: { type: "string" },
      business_problem: { type: "string" },
      hard_filters: { type: "array", items: { type: "string" } },
      soft_preferences: { type: "array", items: { type: "string" } },
      disqualifiers: { type: "array", items: { type: "string" } },
    },
    required: [
      "target_company_type",
      "industries",
      "geography",
      "headcount_range",
      "buyer_persona",
      "business_problem",
      "hard_filters",
      "soft_preferences",
      "disqualifiers",
    ],
  },
};

/**
 * Proposes a structured ICP breakdown for the pre-run filter modal -- a
 * SUGGESTION for the human to review/adjust; nothing is saved by this call.
 *
 * Deliberately a direct Anthropic Messages API call, not a Claude Agent SDK
 * `query()`. Real evidence: the SDK route (even stripped to a single tool,
 * no skills, Haiku) still took 30s+ and hit its own timeout -- that harness's
 * subprocess/MCP-server startup overhead is a fixed cost per call, and for a
 * single-shot structured-extraction task with no multi-turn tool use, it
 * dwarfs the actual model latency. A plain HTTP request has none of that.
 */
export async function inferIcpCriteria(objective: string): Promise<IcpCriteria> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set (see .env.local.example).");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              `Qualification objective: "${objective}"\n\n` +
              "Produce your best structured ICP suggestion for this objective per the rules above, then call " +
              "submit_icp_suggestion exactly once with it.",
          },
        ],
        tools: [ICP_TOOL],
        tool_choice: { type: "tool", name: "submit_icp_suggestion" },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error("ICP inference took too long (20s) and was aborted. Try again, or write the ICP fields yourself.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anthropic API error (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const toolUse = (data.content ?? []).find(
    (block: { type: string; name?: string }) => block.type === "tool_use" && block.name === "submit_icp_suggestion"
  );
  if (!toolUse) throw new Error("Model did not call submit_icp_suggestion.");

  return icpSchema.parse(toolUse.input);
}

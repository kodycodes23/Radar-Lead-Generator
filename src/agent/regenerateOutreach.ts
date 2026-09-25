import { z } from "zod";
import type { Lead } from "@/lib/types";

export type RegenerateTarget = { type: "email"; step: 1 | 2 | 3 } | { type: "linkedin" };

export type RegeneratedContent =
  | { type: "email"; subject: string; body: string; personalization_note: string }
  | { type: "linkedin"; message: string };

const emailContentSchema = z.object({
  type: z.literal("email"),
  subject: z.string(),
  body: z.string(),
  personalization_note: z.string(),
});
const linkedinContentSchema = z.object({
  type: z.literal("linkedin"),
  message: z.string(),
});
const contentSchema = z.discriminatedUnion("type", [emailContentSchema, linkedinContentSchema]);

// Inlined from the outbound-copywriting skill's Copy Rules -- kept in sync
// manually since this deliberately doesn't load the skill (see below).
const SYSTEM_PROMPT =
  "You are Koya Talent's outbound copywriter, revising ONE piece of outreach for a single already-qualified " +
  "lead. This is a draft for human review -- it is never sent automatically, there is no send capability " +
  "anywhere in this system.\n\n" +
  "Copy rules:\n" +
  "- Use only company context actually gathered during research (fit reasons, concerns, source summary) -- no invented facts.\n" +
  "- Keep each email short and direct; write like a person, not a promotion.\n" +
  '- Avoid fake urgency, exaggerated claims, and generic praise ("Loved what you\'re building", "Your company looks impressive").\n' +
  "- Good personalization references evidence: positioning, audience served, a hiring/scaling signal, a public workflow clue.\n" +
  "- Do not include personal email addresses.\n" +
  "- Every claim must be traceable back to the evidence given.";

const REGEN_TOOL = {
  name: "submit_regenerated_content",
  description: "Submit the regenerated outreach content for this one piece.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: { type: "string", enum: ["email", "linkedin"] },
      subject: { type: "string" },
      body: { type: "string" },
      personalization_note: { type: "string" },
      message: { type: "string" },
    },
    required: ["type"],
  },
};

/**
 * Regenerates exactly one outreach piece for an already-qualified lead, using
 * only that lead's stored evidence plus an optional human tweak instruction.
 * Returns the draft without persisting it; the caller decides whether to
 * keep or discard it.
 *
 * Deliberately a direct Anthropic Messages API call, not a Claude Agent SDK
 * `query()` (as this used to be). Real evidence: the SDK route (skills:"all",
 * a Skill-tool round trip, an MCP server) once took a person 4 minutes with
 * no timeout to bound it -- that harness's subprocess/MCP-server startup
 * overhead is a fixed cost per call, and for a single-shot rewrite task with
 * no multi-turn tool use, it dwarfs the actual model latency. Kept on the
 * full-strength default model (unlike the ICP-inference call, which uses
 * Haiku) because copywriting quality genuinely matters here, unlike narrow
 * structured extraction -- the fix is removing unnecessary architecture, not
 * lowering output quality.
 */
export async function regenerateOutreachPiece(
  lead: Lead,
  target: RegenerateTarget,
  instruction: string | undefined
): Promise<RegeneratedContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set (see .env.local.example).");

  const evidence =
    `Company: ${lead.company_name} (${lead.company_domain})\n` +
    `Fit reasons: ${lead.fit_reasons.join("; ") || "none recorded"}\n` +
    `Concerns: ${lead.concerns.join("; ") || "none recorded"}\n` +
    `Source summary: ${lead.source_summary || "none recorded"}`;

  const targetDescription =
    target.type === "email"
      ? `Regenerate email ${target.step} of the 3-step cold email sequence -- return type "email" plus subject, body, and personalization_note.`
      : 'Regenerate the short LinkedIn message -- return type "linkedin" plus message.';

  const userContent =
    `${evidence}\n\n${targetDescription}` +
    (instruction
      ? `\n\nApply this tweak instruction from the reviewer while still following every copy rule: "${instruction}"`
      : "") +
    "\n\nCall submit_regenerated_content exactly once.";

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
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
        tools: [REGEN_TOOL],
        tool_choice: { type: "tool", name: "submit_regenerated_content" },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error("Regeneration took too long (20s) and was aborted. Try again.");
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
    (block: { type: string; name?: string }) => block.type === "tool_use" && block.name === "submit_regenerated_content"
  );
  if (!toolUse) throw new Error("Model did not call submit_regenerated_content.");

  return contentSchema.parse(toolUse.input);
}

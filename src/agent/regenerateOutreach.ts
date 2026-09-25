import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
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

/**
 * Regenerates exactly one outreach piece for an already-qualified lead,
 * using only that lead's stored evidence plus an optional human tweak
 * instruction. This is a narrow, single-purpose agent call -- no discovery,
 * no scraping, no Apify -- reusing the outbound-copywriting skill on disk
 * the same way the main pipeline does. Returns the draft without persisting
 * it; the caller decides whether to keep or discard it.
 */
export async function regenerateOutreachPiece(
  lead: Lead,
  target: RegenerateTarget,
  instruction: string | undefined
): Promise<RegeneratedContent> {
  let captured: RegeneratedContent | null = null;

  const submitTool = tool(
    "submit_regenerated_content",
    "Submit the regenerated outreach content for this one piece. Call exactly once.",
    { content: z.discriminatedUnion("type", [emailContentSchema, linkedinContentSchema]) },
    async (args) => {
      captured = args.content;
      return { content: [{ type: "text", text: "Received." }] };
    },
    { annotations: { readOnlyHint: false, destructiveHint: false } }
  );

  const server = createSdkMcpServer({ name: "regen", version: "1.0.0", tools: [submitTool] });

  const systemPrompt = `You are Koya Talent's outbound copywriter, revising ONE piece of outreach for a single already-qualified lead. Follow the outbound-copywriting skill's rules exactly: use only the evidence below, no invented facts, no fake urgency or exaggerated claims, no generic praise, calm and credible tone, every claim traceable to the evidence. This is a draft for human review -- it is never sent automatically, there is no send capability anywhere in this system.

Evidence for this lead (the only facts you may reference):
Company: ${lead.company_name} (${lead.company_domain})
Fit reasons: ${lead.fit_reasons.join("; ") || "none recorded"}
Concerns: ${lead.concerns.join("; ") || "none recorded"}
Source summary: ${lead.source_summary || "none recorded"}`;

  const targetDescription =
    target.type === "email"
      ? `Regenerate email ${target.step} of the 3-step cold email sequence (subject, body, and personalization_note).`
      : "Regenerate the short LinkedIn message.";

  const shape =
    target.type === "email"
      ? `{"type":"email","subject":"...","body":"...","personalization_note":"..."}`
      : `{"type":"linkedin","message":"..."}`;

  const prompt = `${targetDescription}${
    instruction ? `\n\nApply this tweak instruction from the reviewer while still following every copy rule above: "${instruction}"` : ""
  }\n\nUse the outbound-copywriting skill, then call submit_regenerated_content exactly once with this shape: ${shape}`;

  for await (const message of query({
    prompt,
    options: {
      systemPrompt,
      cwd: process.cwd(),
      settingSources: ["project"],
      skills: "all",
      tools: ["Skill"],
      allowedTools: ["mcp__regen__submit_regenerated_content", "Skill"],
      mcpServers: { regen: server },
      maxTurns: 8,
      permissionMode: "bypassPermissions",
    },
  })) {
    if (message.type === "result" && message.subtype !== "success") {
      throw new Error(`Regeneration agent ended with subtype "${message.subtype}".`);
    }
  }

  if (!captured) throw new Error("Agent did not submit regenerated content.");
  return captured;
}

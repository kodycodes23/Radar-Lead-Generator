import { NextResponse } from "next/server";
import { z } from "zod";
import { getLead, logToolCall } from "@/lib/db";
import { regenerateOutreachPiece } from "@/agent/regenerateOutreach";

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("email"),
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    instruction: z.string().optional(),
  }),
  z.object({ type: z.literal("linkedin"), instruction: z.string().optional() }),
]);

// Regenerates exactly one outreach piece via a live, scoped Claude Agent SDK
// call (real but trivial cost -- no Apify, no re-scraping; it reuses the
// lead's already-stored evidence). Returns the draft WITHOUT persisting it --
// the reviewer explicitly keeps or discards it via PATCH /outreach.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const target = parsed.data;

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.qualification_status !== "qualified") {
    return NextResponse.json(
      { error: "Outreach regeneration only applies to qualified leads." },
      { status: 400 }
    );
  }

  const purpose =
    target.type === "email"
      ? `Regenerate email ${target.step} for ${lead.company_name}`
      : `Regenerate LinkedIn message for ${lead.company_name}`;
  const inputSummary = target.instruction?.trim() || "(no additional instruction)";
  const start = Date.now();

  try {
    const draft = await regenerateOutreachPiece(
      lead,
      target.type === "email" ? { type: "email", step: target.step } : { type: "linkedin" },
      target.instruction?.trim() || undefined
    );

    const resultSummary =
      draft.type === "email" ? `Subject: ${draft.subject}` : draft.message.slice(0, 120);

    await logToolCall({
      run_id: lead.run_id,
      lead_id: lead.id,
      tool_name: "regenerate_outreach",
      purpose,
      input_summary: inputSummary,
      result_summary: resultSummary,
      status: "success",
      duration_ms: Date.now() - start,
    });

    return NextResponse.json({ draft });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logToolCall({
      run_id: lead.run_id,
      lead_id: lead.id,
      tool_name: "regenerate_outreach",
      purpose,
      input_summary: inputSummary,
      status: "error",
      error_message: message,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

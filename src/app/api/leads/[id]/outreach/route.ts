import { NextResponse } from "next/server";
import { z } from "zod";
import { updateOutreachPiece } from "@/lib/db";

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("email"),
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    subject: z.string().min(1),
    body: z.string().min(1),
    personalization_note: z.string(),
    source: z.enum(["manual", "regenerated"]),
  }),
  z.object({
    type: z.literal("linkedin"),
    message: z.string().min(1),
    source: z.enum(["manual", "regenerated"]),
  }),
]);

// Saves an edit (or an accepted regeneration) for exactly one outreach
// piece -- one email step, or the LinkedIn message -- without touching
// any of the lead's other outreach content.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const lead = await updateOutreachPiece(id, parsed.data);
    return NextResponse.json({ lead });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getRun, answerClarifyingQuestion } from "@/lib/db";
import { resolveClarification } from "@/agent/clarification";

const bodySchema = z.object({ answer: z.string().trim().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }
  if (run.status !== "needs_clarification") {
    return NextResponse.json(
      { error: `This run isn't waiting for clarification (status: ${run.status}).` },
      { status: 409 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  }

  await answerClarifyingQuestion(id, parsed.data.answer);

  const resumed = resolveClarification(id, parsed.data.answer);
  if (!resumed) {
    // The answer is saved either way, but the in-process agent that asked
    // the question is gone (most likely a dev-server restart while the
    // question was pending) -- it can't be woken up automatically.
    return NextResponse.json(
      {
        ok: false,
        error:
          "Answer saved, but this run's agent process is no longer active and can't resume automatically. Start a new run with the answer folded into the objective instead.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}

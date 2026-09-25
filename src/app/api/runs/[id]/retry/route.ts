import { NextResponse } from "next/server";
import { createRetryRun, getRun } from "@/lib/db";
import { runAgent } from "@/agent/runAgent";
import { ACTIVE_RUN_STATUSES } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const original = await getRun(id);
  if (!original) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }
  if (ACTIVE_RUN_STATUSES.includes(original.status)) {
    return NextResponse.json({ error: "This run is still in progress -- wait for it to finish before retrying." }, { status: 409 });
  }

  const retryRun = await createRetryRun(id);

  // Same fire-and-forget pattern as POST /api/runs -- see that route.
  runAgent(retryRun.id).catch((error) => {
    console.error(`runAgent(${retryRun.id}) crashed outside its own error handling:`, error);
  });

  return NextResponse.json({ runId: retryRun.id }, { status: 201 });
}

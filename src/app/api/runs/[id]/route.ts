import { NextResponse } from "next/server";
import { getLeadsForRun, getRun, getToolCallsForRun, getRunFamily, getOutreachEditsForRun } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const [leads, toolCalls, family, outreachEdits] = await Promise.all([
    getLeadsForRun(id),
    getToolCallsForRun(id),
    getRunFamily(id),
    getOutreachEditsForRun(id),
  ]);

  return NextResponse.json({ run, leads, toolCalls, family, outreachEdits });
}

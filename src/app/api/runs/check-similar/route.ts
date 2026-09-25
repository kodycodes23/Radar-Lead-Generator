import { NextResponse } from "next/server";
import { z } from "zod";
import { findSimilarRuns } from "@/lib/db";

const bodySchema = z.object({ objective: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  }

  const similar = await findSimilarRuns(parsed.data.objective);
  return NextResponse.json({ similar });
}

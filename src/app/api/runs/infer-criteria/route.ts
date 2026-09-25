import { NextResponse } from "next/server";
import { z } from "zod";
import { inferIcpCriteria } from "@/agent/inferIcpCriteria";

const bodySchema = z.object({ objective: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  }

  try {
    const icp = await inferIcpCriteria(parsed.data.objective);
    return NextResponse.json({ icp });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to infer ICP criteria." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getErrorCountSince } from "@/lib/db";

export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since");
  if (!since) {
    return NextResponse.json({ error: "since query param is required" }, { status: 400 });
  }
  const count = await getErrorCountSince(since);
  return NextResponse.json({ count });
}

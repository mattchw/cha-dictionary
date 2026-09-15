import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/suggest";

export const runtime = "nodejs";

// GET /api/suggest?q=wel&limit=8
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(
    20,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "8") || 8)
  );

  try {
    return NextResponse.json({ suggestions: suggest(q, limit) });
  } catch {
    return NextResponse.json({ error: "wordlist_unavailable" }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { spellSuggest } from "@/lib/spell-suggest";

export const runtime = "nodejs";

// GET /api/spell?q=helo  ->  { suggestions: ["hello", ...] }
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(5, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "3") || 3));

  try {
    return NextResponse.json({ suggestions: spellSuggest(q, limit) });
  } catch {
    return NextResponse.json({ error: "spell_unavailable" }, { status: 503 });
  }
}

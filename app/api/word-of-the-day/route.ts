import { NextResponse } from "next/server";
import { getWordOfDay } from "@/lib/word-of-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/word-of-the-day  ->  deterministic daily vocabulary pick
export async function GET() {
  return NextResponse.json(getWordOfDay());
}

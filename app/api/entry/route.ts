import { NextRequest, NextResponse } from "next/server";
import { fetchEnglishEntry, WordNotFoundError } from "@/lib/dictionary";
import { lookupCefrLevel } from "@/lib/cefr";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { DictEntry } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/entry?word=hello  ->  English entry (definitions, examples, audio)
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim();
  if (!word) return NextResponse.json({ error: "missing_word" }, { status: 400 });

  const key = `en:${word.toLowerCase()}`;
  try {
    let entry = cacheGet<DictEntry>(key);
    if (!entry) {
      entry = await fetchEnglishEntry(word);
      cacheSet(key, entry);
    }
    return NextResponse.json({ ...entry, cefr: lookupCefrLevel(entry.word) });
  } catch (err) {
    if (err instanceof WordNotFoundError)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  fetchEnglishEntry,
  collectStrings,
  applyTranslations,
  WordNotFoundError,
} from "@/lib/dictionary";
import { translateStrings } from "@/lib/cedict";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { DictEntry } from "@/lib/types";

export const runtime = "nodejs";

async function translateEntry(entry: DictEntry): Promise<DictEntry> {
  const lc = entry.word.toLowerCase();
  const mergedKey = `full:${lc}`;

  const cached = cacheGet<DictEntry>(mergedKey);
  if (cached) return cached;

  const zh = await translateStrings(collectStrings(entry));
  const merged = applyTranslations(entry, zh);
  cacheSet(mergedKey, merged);
  return merged;
}

// GET /api/translate?word=hello  ->  English + 香港繁體 merged entry
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim();
  if (!word) return NextResponse.json({ error: "missing_word" }, { status: 400 });

  const lc = word.toLowerCase();

  try {
    const cached = cacheGet<DictEntry>(`full:${lc}`);
    if (cached) return NextResponse.json(cached);

    // Reuse the English entry if /api/entry already fetched it this session.
    let entry = cacheGet<DictEntry>(`en:${lc}`);
    if (!entry) {
      entry = await fetchEnglishEntry(word);
      cacheSet(`en:${lc}`, entry);
    }

    return NextResponse.json(await translateEntry(entry));
  } catch (err) {
    if (err instanceof WordNotFoundError)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "translate_failed" }, { status: 502 });
  }
}

// POST /api/translate  { entry }  ->  merged entry (no dictionary re-fetch)
export async function POST(req: NextRequest) {
  let body: { entry?: DictEntry };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const entry = body.entry;
  if (!entry?.word?.trim()) {
    return NextResponse.json({ error: "missing_entry" }, { status: 400 });
  }

  try {
    return NextResponse.json(await translateEntry(entry));
  } catch (err) {
    if (err instanceof WordNotFoundError)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "translate_failed" }, { status: 502 });
  }
}

import type { DictEntry } from "./types";

const CAP_DEFS_PER_MEANING = 3;

export class WordNotFoundError extends Error {}

function normalizeAudio(url: string | undefined | null): string | null {
  if (!url) return null;
  return url.startsWith("//") ? "https:" + url : url;
}

// Fetch an English entry from dictionaryapi.dev and reshape it into our tidy,
// capped DictEntry. Runs server-side, so no CORS issues.
export async function fetchEnglishEntry(word: string): Promise<DictEntry> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`,
    // Next.js data cache: reuse the upstream response for a day across requests.
    { next: { revalidate: 60 * 60 * 24 } }
  );

  if (res.status === 404) throw new WordNotFoundError(word);
  if (!res.ok) throw new Error(`dictionaryapi.dev error ${res.status}`);

  const data = (await res.json()) as any[];
  if (!Array.isArray(data) || data.length === 0) throw new WordNotFoundError(word);

  const first = data[0];

  // Audio can live on any entry's phonetics array.
  let audio: string | null = null;
  for (const e of data) {
    const hit = (e.phonetics || []).find((p: any) => p.audio);
    if (hit) {
      audio = normalizeAudio(hit.audio);
      break;
    }
  }

  const meanings: DictEntry["meanings"] = (first.meanings || []).map((m: any) => ({
    partOfSpeech: m.partOfSpeech,
    definitions: (m.definitions || [])
      .slice(0, CAP_DEFS_PER_MEANING)
      .map((d: any) => ({ en: d.definition, example: d.example ?? null })),
  }));

  return {
    word: first.word,
    phonetic:
      first.phonetic || (first.phonetics || []).find((p: any) => p.text)?.text || null,
    audio,
    meanings,
  };
}

// Flatten every string that needs translating, in a fixed order.
export function collectStrings(entry: DictEntry): string[] {
  const out = [entry.word];
  for (const m of entry.meanings) {
    for (const d of m.definitions) {
      out.push(d.en);
      if (d.example) out.push(d.example);
    }
  }
  return out;
}

// Re-walk in the same order and attach the Traditional Chinese strings.
export function applyTranslations(entry: DictEntry, zh: string[]): DictEntry {
  let i = 0;
  const wordZh = zh[i++] ?? null;
  const meanings = entry.meanings.map((m) => ({
    partOfSpeech: m.partOfSpeech,
    definitions: m.definitions.map((d) => {
      const dz = zh[i++] ?? null;
      const ez = d.example ? zh[i++] ?? null : null;
      return { ...d, zh: dz, exampleZh: ez };
    }),
  }));
  return { ...entry, wordZh, meanings };
}

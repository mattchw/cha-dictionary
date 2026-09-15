import { findRelatedWords } from "./cedict";
import type { DictEntry, Meaning } from "./types";

import { INITIAL_DEFS_PER_MEANING, MAX_DEFS_PER_MEANING } from "./dictionary-constants";

export { INITIAL_DEFS_PER_MEANING, MAX_DEFS_PER_MEANING };
const FETCH_TIMEOUT_MS = 10_000;

export class WordNotFoundError extends Error {}

function normalizeAudio(url: string | undefined | null): string | null {
  if (!url) return null;
  return url.startsWith("//") ? "https:" + url : url;
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

// Primary: freedictionaryapi.com (Wiktionary data, fast and reliable).
async function fetchFromFreeDictionary(word: string): Promise<DictEntry> {
  const res = await fetchWithTimeout(
    `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word.trim())}`
  );

  if (!res.ok) throw new Error(`freedictionaryapi error ${res.status}`);

  const data = (await res.json()) as {
    word?: string;
    entries?: {
      partOfSpeech: string;
      pronunciations?: { text?: string }[];
      senses?: { definition: string; examples?: string[] }[];
    }[];
  };

  if (!data.entries?.length) throw new WordNotFoundError(word);

  let phonetic: string | null = null;
  for (const entry of data.entries) {
    const text = entry.pronunciations?.[0]?.text;
    if (text) {
      phonetic = text;
      break;
    }
  }

  const meanings: DictEntry["meanings"] = data.entries
    .map((entry) => ({
      partOfSpeech: entry.partOfSpeech,
      definitions: (entry.senses || [])
        .slice(0, MAX_DEFS_PER_MEANING)
        .map((sense) => ({
          en: sense.definition,
          example: sense.examples?.[0] ?? null,
        })),
    }))
    .filter((m) => m.definitions.length > 0);

  if (!meanings.length) throw new WordNotFoundError(word);

  return {
    word: data.word || word,
    phonetic,
    audio: null,
    meanings,
  };
}

// Fallback: dictionaryapi.dev (includes audio when available, but often slow/down).
async function fetchFromDictionaryApiDev(word: string): Promise<DictEntry> {
  const res = await fetchWithTimeout(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`
  );

  if (res.status === 404) throw new WordNotFoundError(word);
  if (!res.ok) throw new Error(`dictionaryapi.dev error ${res.status}`);

  const data = (await res.json()) as any[];
  if (!Array.isArray(data) || data.length === 0) throw new WordNotFoundError(word);

  const first = data[0];

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
      .slice(0, MAX_DEFS_PER_MEANING)
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

// Fetch an English entry and reshape it into our tidy, capped DictEntry.
export async function fetchEnglishEntry(word: string): Promise<DictEntry> {
  try {
    return await fetchFromFreeDictionary(word);
  } catch (err) {
    if (err instanceof WordNotFoundError) throw err;
  }

  return await fetchFromDictionaryApiDev(word);
}

export function collectStringsForMeaning(
  meaning: Meaning,
  fromDefIndex = 0
): string[] {
  const out: string[] = [];
  for (const d of meaning.definitions.slice(fromDefIndex)) {
    out.push(d.en);
    if (d.example) out.push(d.example);
  }
  return out;
}

// Flatten every string that needs translating, in a fixed order.
export function collectStrings(
  entry: DictEntry,
  defsPerMeaning = Infinity
): string[] {
  const out = [entry.word];
  for (const m of entry.meanings) {
    for (const d of m.definitions.slice(0, defsPerMeaning)) {
      out.push(d.en);
      if (d.example) out.push(d.example);
    }
  }
  return out;
}

export function applyTranslationsToMeaning(
  meaning: Meaning,
  fromDefIndex: number,
  zh: (string | null)[]
): Meaning {
  let i = 0;
  return {
    partOfSpeech: meaning.partOfSpeech,
    definitions: meaning.definitions.map((d, di) => {
      if (di < fromDefIndex) return d;
      const dz = zh[i++] ?? null;
      const ez = d.example ? zh[i++] ?? null : null;
      return { ...d, zh: dz, exampleZh: ez };
    }),
  };
}

// Re-walk in the same order and attach the Traditional Chinese strings.
export function applyTranslations(
  entry: DictEntry,
  zh: (string | null)[],
  defsPerMeaning = Infinity
): DictEntry {
  let i = 0;
  const wordZh = zh[i++] ?? null;
  const meanings = entry.meanings.map((m) => ({
    partOfSpeech: m.partOfSpeech,
    definitions: m.definitions.map((d, di) => {
      if (di >= defsPerMeaning) return d;
      const dz = zh[i++] ?? null;
      const ez = d.example ? zh[i++] ?? null : null;
      return { ...d, zh: dz, exampleZh: ez };
    }),
  }));
  return {
    ...entry,
    wordZh,
    meanings,
    relatedWords: entry.relatedWords ?? findRelatedWords(entry.word),
  };
}

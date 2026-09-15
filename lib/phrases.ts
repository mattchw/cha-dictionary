import { readFileSync } from "fs";
import { join } from "path";

type PhraseData = {
  phrases: string[];
  zh: Record<string, string>;
};

let data: PhraseData | null = null;

function loadPhrases(): PhraseData {
  if (data) return data;
  const file = join(process.cwd(), "data", "phrases.json");
  data = JSON.parse(readFileSync(file, "utf8")) as PhraseData;
  return data;
}

function lowerBound(arr: string[], prefix: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function isPhraseQuery(query: string): boolean {
  return /\s/.test(query.trim());
}

export function phraseLookupKeys(query: string): string[] {
  const q = query.toLowerCase().trim();
  const keys = [q];
  if (!q.startsWith("to ")) keys.push(`to ${q}`);
  else keys.push(q.slice(3));
  return keys;
}

export function lookupPhraseZh(phrase: string): string | null {
  const { zh } = loadPhrases();
  for (const key of phraseLookupKeys(phrase)) {
    const hit = zh[key];
    if (hit) return hit;
  }
  return null;
}

export function suggestPhrases(prefix: string, limit = 8): string[] {
  const q = prefix.trim().toLowerCase();
  if (q.length < 2) return [];

  const { phrases } = loadPhrases();
  const start = lowerBound(phrases, q);
  const out: string[] = [];

  for (let i = start; i < phrases.length && out.length < limit; i++) {
    const phrase = phrases[i];
    if (!phrase.startsWith(q)) break;
    out.push(phrase);
  }

  return out;
}

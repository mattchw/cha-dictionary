import { suggestPhrases } from "./phrases";
import { suggestWords } from "./wordlist";

function mergeSuggestions(words: string[], phrases: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const preferPhrases = phrases.length > 0 && phrases.some((p) => p.includes(" "));
  const order = preferPhrases
    ? [...phrases, ...words]
    : [...words, ...phrases];

  for (const item of order) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

export function suggest(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const phraseFirst = q.includes(" ");
  const wordLimit = phraseFirst ? Math.max(2, limit - 4) : limit;
  const phraseLimit = phraseFirst ? limit : Math.min(4, limit);

  const words = suggestWords(q, wordLimit);
  const phrases = suggestPhrases(q, phraseLimit);

  return mergeSuggestions(words, phrases, limit);
}

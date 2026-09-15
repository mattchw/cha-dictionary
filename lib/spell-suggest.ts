import { levenshtein } from "./levenshtein";
import { suggestWords, wordFrequency } from "./wordlist";

export function spellSuggest(query: string, limit = 3): string[] {
  const q = query.toLowerCase().trim();
  if (q.length < 3 || !/^[a-z]+$/.test(q)) return [];

  const pool = new Set<string>();
  for (const prefix of [q.slice(0, 3), q.slice(0, 2), q.slice(0, 1)]) {
    if (!prefix) continue;
    for (const word of suggestWords(prefix, 60)) pool.add(word);
  }

  return [...pool]
    .map((word) => ({
      word,
      dist: levenshtein(q, word),
      freq: wordFrequency(word),
    }))
    .filter((x) => x.dist > 0 && x.dist <= 2)
    .sort((a, b) => a.dist - b.dist || b.freq - a.freq)
    .slice(0, limit)
    .map((x) => x.word);
}

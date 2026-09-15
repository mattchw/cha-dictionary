import { levenshtein } from "./levenshtein";

let freqWords: { word: string; freq: number }[] | null = null;

async function loadFreqWords(): Promise<{ word: string; freq: number }[]> {
  if (freqWords) return freqWords;
  const res = await fetch("/data/frequency.txt");
  if (!res.ok) throw new Error("frequency_unavailable");
  freqWords = (await res.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const space = line.lastIndexOf(" ");
      return { word: line.slice(0, space), freq: Number(line.slice(space + 1)) };
    });
  return freqWords;
}

export async function spellSuggestClient(query: string, limit = 3): Promise<string[]> {
  const q = query.toLowerCase().trim();
  if (q.length < 3 || !/^[a-z]+$/.test(q)) return [];

  const list = await loadFreqWords();
  const prefixes = [q.slice(0, 3), q.slice(0, 2), q.slice(0, 1)].filter(Boolean);

  const pool = new Set<string>();
  for (const { word } of list) {
    if (!/^[a-z]+$/.test(word)) continue;
    if (!prefixes.some((p) => word.startsWith(p))) continue;
    pool.add(word);
    if (pool.size >= 120) break;
  }

  return [...pool]
    .map((word) => ({
      word,
      dist: levenshtein(q, word),
      freq: list.find((w) => w.word === word)?.freq ?? 0,
    }))
    .filter((x) => x.dist > 0 && x.dist <= 2)
    .sort((a, b) => a.dist - b.dist || b.freq - a.freq)
    .slice(0, limit)
    .map((x) => x.word);
}

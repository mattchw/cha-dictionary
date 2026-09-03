import { readFileSync } from "fs";
import { join } from "path";

let words: string[] | null = null;
let freqWords: { word: string; freq: number }[] | null = null;

function loadWords(): string[] {
  if (words) return words;
  const file = join(process.cwd(), "data", "words.txt");
  words = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean);
  return words;
}

function loadFreqWords(): { word: string; freq: number }[] {
  if (freqWords) return freqWords;
  const file = join(process.cwd(), "data", "frequency.txt");
  freqWords = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const space = line.lastIndexOf(" ");
      return {
        word: line.slice(0, space),
        freq: Number(line.slice(space + 1)),
      };
    });
  return freqWords;
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

// Prefix search: common words first (frequency-ranked), then obscure matches.
export function suggestWords(prefix: string, limit = 8): string[] {
  const q = prefix.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const { word } of loadFreqWords()) {
    if (!/^[a-z]+$/.test(word) || !word.startsWith(q)) continue;
    out.push(word);
    seen.add(word);
    if (out.length >= limit) return out;
  }

  const list = loadWords();
  const start = lowerBound(list, q);
  for (let i = start; i < list.length && out.length < limit; i++) {
    const word = list[i];
    if (!word.startsWith(q)) break;
    if (seen.has(word)) continue;
    out.push(word);
  }

  return out;
}

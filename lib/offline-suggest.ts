import { offlineSuggestPhrases } from "./phrases-client";

let freqWords: { word: string; freq: number }[] | null = null;

async function loadFreqWords(): Promise<{ word: string; freq: number }[]> {
  if (freqWords) return freqWords;

  const res = await fetch("/data/frequency.txt");
  if (!res.ok) throw new Error("frequency_unavailable");

  const text = await res.text();
  freqWords = text
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

function mergeSuggestions(words: string[], phrases: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const phraseFirst = phrases.length > 0;
  const order = phraseFirst ? [...phrases, ...words] : [...words, ...phrases];

  for (const item of order) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

export async function offlineSuggest(prefix: string, limit = 8): Promise<string[]> {
  const q = prefix.trim().toLowerCase();
  if (q.length < 2) return [];

  const phraseFirst = q.includes(" ");
  const wordLimit = phraseFirst ? Math.max(2, limit - 4) : limit;
  const phraseLimit = phraseFirst ? limit : Math.min(4, limit);

  const list = await loadFreqWords();
  const words: string[] = [];
  for (const { word } of list) {
    if (!/^[a-z]+$/.test(word) || !word.startsWith(q)) continue;
    words.push(word);
    if (words.length >= wordLimit) break;
  }

  let phrases: string[] = [];
  try {
    phrases = await offlineSuggestPhrases(q, phraseLimit);
  } catch {
    // phrases bundle unavailable
  }

  return mergeSuggestions(words, phrases, limit);
}

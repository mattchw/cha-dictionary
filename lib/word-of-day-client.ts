import c1c2Words from "@/data/c1c2-words.json";
import cefrLevels from "@/data/cefr-levels.json";
import type { CefrLevel, WordOfDay } from "@/lib/types";

const pool = (c1c2Words as { word: string }[]).map((w) => w.word).sort();
const levels = cefrLevels as Record<string, CefrLevel>;

function dayIndex(key: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}

export function getWordOfDayClient(date = new Date()): WordOfDay {
  const dateStr = date.toISOString().slice(0, 10);
  const word = pool[dayIndex(dateStr, pool.length)];
  return {
    word,
    date: dateStr,
    cefr: levels[word.toLowerCase()] ?? null,
  };
}

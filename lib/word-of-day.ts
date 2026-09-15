import { readFileSync } from "fs";
import { join } from "path";
import type { CefrLevel } from "@/lib/types";
import { lookupCefrLevel } from "@/lib/cefr";

type WordOfDay = {
  word: string;
  date: string;
  cefr: CefrLevel | null;
};

let pool: string[] | null = null;

function loadPool(): string[] {
  if (pool) return pool;

  const file = join(process.cwd(), "data", "c1c2-words.json");
  const words = JSON.parse(readFileSync(file, "utf8")) as { word: string }[];
  pool = words.map((w) => w.word).sort();
  return pool;
}

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function dayIndex(key: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}

export function getWordOfDay(date = new Date()): WordOfDay {
  const words = loadPool();
  const dateStr = dayKey(date);
  const word = words[dayIndex(dateStr, words.length)];

  return {
    word,
    date: dateStr,
    cefr: lookupCefrLevel(word),
  };
}

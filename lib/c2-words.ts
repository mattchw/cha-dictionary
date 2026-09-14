import c1c2Words from "@/data/c1c2-words.json";
import type { CefrLevel } from "@/lib/types";

export type ChipWord = {
  word: string;
  level: "C1" | "C2";
};

const pool = c1c2Words as ChipWord[];

// CEFR C1 + C2 headwords (Octanove / CEFR-J) for home-page suggestion chips.
export function pickRandomChips(count: number): ChipWord[] {
  const copy = [...pool];
  const n = Math.min(count, pool.length);
  const out: ChipWord[] = [];

  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * (copy.length - i)) + i;
    [copy[i], copy[j]] = [copy[j], copy[i]];
    out.push(copy[i]);
  }

  return out;
}

export function cefrBadgeClass(level: CefrLevel): string {
  return `dc-cefr dc-cefr-${level.toLowerCase()}`;
}

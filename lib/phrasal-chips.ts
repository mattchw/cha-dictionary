import chips from "@/data/phrasal-chips.json";

export type PhrasalChip = {
  phrase: string;
  zh: string;
};

const pool = chips as PhrasalChip[];

export function pickRandomPhrasalChips(count: number): PhrasalChip[] {
  const copy = [...pool];
  const n = Math.min(count, pool.length);
  const out: PhrasalChip[] = [];

  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * (copy.length - i)) + i;
    [copy[i], copy[j]] = [copy[j], copy[i]];
    out.push(copy[i]);
  }

  return out;
}

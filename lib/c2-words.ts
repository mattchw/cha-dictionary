import c1c2Words from "@/data/c1c2-words.json";

// CEFR C1 + C2 headwords (Octanove / CEFR-J) for home-page suggestion chips.
export function pickRandomC1C2Words(count: number): string[] {
  const pool = [...c1c2Words];
  const n = Math.min(count, pool.length);
  const out: string[] = [];

  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * (pool.length - i)) + i;
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }

  return out;
}

// Back-compat alias
export const pickRandomC2Words = pickRandomC1C2Words;

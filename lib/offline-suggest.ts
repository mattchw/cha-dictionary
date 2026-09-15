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

export async function offlineSuggest(prefix: string, limit = 8): Promise<string[]> {
  const q = prefix.trim().toLowerCase();
  if (q.length < 2) return [];

  const list = await loadFreqWords();
  const out: string[] = [];

  for (const { word } of list) {
    if (!/^[a-z]+$/.test(word) || !word.startsWith(q)) continue;
    out.push(word);
    if (out.length >= limit) break;
  }

  return out;
}

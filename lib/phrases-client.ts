type PhraseData = {
  phrases: string[];
  zh: Record<string, string>;
};

let data: PhraseData | null = null;

async function loadPhrases(): Promise<PhraseData> {
  if (data) return data;
  const res = await fetch("/data/phrases.json");
  if (!res.ok) throw new Error("phrases_unavailable");
  data = (await res.json()) as PhraseData;
  return data;
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

export async function offlineSuggestPhrases(prefix: string, limit = 8): Promise<string[]> {
  const q = prefix.trim().toLowerCase();
  if (q.length < 2) return [];

  const { phrases } = await loadPhrases();
  const start = lowerBound(phrases, q);
  const out: string[] = [];

  for (let i = start; i < phrases.length && out.length < limit; i++) {
    const phrase = phrases[i];
    if (!phrase.startsWith(q)) break;
    out.push(phrase);
  }

  return out;
}

import { readFileSync } from "fs";
import { join } from "path";
import { fillMissingTranslations } from "./translate";

// CC-CEDICT reverse index: English gloss -> Traditional Chinese headwords.
// File format: 歡迎 欢迎 [huan1 ying2] /to welcome/welcome/

const LINE_RE = /^(\S+)\s+(\S+)\s+\[[^\]]*\]\s+\/(.+)\/$/;

let reverseIndex: Map<string, string[]> | null = null;

function loadIndex(): Map<string, string[]> {
  if (reverseIndex) return reverseIndex;

  const file = join(process.cwd(), "data", "cedict.txt");
  const index = new Map<string, string[]>();

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;

    const traditional = m[1];
    const glosses = m[3].split("/").filter(Boolean);

    for (const gloss of glosses) {
      const key = gloss.toLowerCase().trim();
      if (!key) continue;
      const bucket = index.get(key);
      if (bucket) {
        if (!bucket.includes(traditional)) bucket.push(traditional);
      } else {
        index.set(key, [traditional]);
      }
    }
  }

  reverseIndex = index;
  return index;
}

// Look up a human-curated 香港繁體 gloss for an English word or short phrase.
export function lookupCedict(english: string): string | null {
  const key = english.toLowerCase().trim();
  if (!key) return null;

  const hits = loadIndex().get(key);
  if (!hits?.length) return null;
  return hits.join("、");
}

// Translate strings with CC-CEDICT; optionally fill gaps via AI (TRANSLATOR_FALLBACK).
export async function translateStrings(strings: string[]): Promise<(string | null)[]> {
  const out: (string | null)[] = strings.map((s) => lookupCedict(s));
  const missing = out
    .map((zh, i) => (zh ? -1 : i))
    .filter((i) => i >= 0);

  if (missing.length) {
    await fillMissingTranslations(
      out,
      missing.map((i) => strings[i])
    );
  }

  return out;
}

import { readFileSync } from "fs";
import { join } from "path";
import { phraseLookupKeys, lookupPhraseZh } from "./phrases";
import { wordFrequency } from "./wordlist";
import { fillMissingTranslations } from "./translate";

// CC-CEDICT reverse index: English gloss -> Traditional Chinese headwords.
// File format: 歡迎 欢迎 [huan1 ying2] /to welcome/welcome/

const LINE_RE = /^(\S+)\s+(\S+)\s+\[[^\]]*\]\s+\/(.+)\/$/;

type CedictEntry = {
  traditional: string;
  glosses: string[];
};

type CedictIndex = {
  reverse: Map<string, CedictEntry[]>;
  byTraditional: Map<string, CedictEntry>;
};

let index: CedictIndex | null = null;

function addReverseEntry(
  reverse: Map<string, CedictEntry[]>,
  key: string,
  entry: CedictEntry
) {
  if (!key) return;
  const bucket = reverse.get(key);
  if (bucket) {
    if (!bucket.some((e) => e.traditional === entry.traditional)) bucket.push(entry);
  } else {
    reverse.set(key, [entry]);
  }
}

function loadIndex(): CedictIndex {
  if (index) return index;

  const file = join(process.cwd(), "data", "cedict.txt");
  const reverse = new Map<string, CedictEntry[]>();
  const byTraditional = new Map<string, CedictEntry>();

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;

    const traditional = m[1];
    const glosses = m[3].split("/").filter(Boolean);
    const entry: CedictEntry = { traditional, glosses };

    if (!byTraditional.has(traditional)) {
      byTraditional.set(traditional, entry);
    }

    for (const gloss of glosses) {
      const key = gloss.toLowerCase().trim();
      addReverseEntry(reverse, key, entry);
      for (const token of glossTokens(gloss)) {
        if (token !== key) addReverseEntry(reverse, token, entry);
      }
    }
  }

  index = { reverse, byTraditional };
  return index;
}

function glossTokens(gloss: string): string[] {
  return gloss
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function primaryGlossBoost(glosses: string[], word: string): number {
  const w = word.toLowerCase();
  for (const gloss of glosses) {
    const trimmed = gloss.toLowerCase().trim();
    if (trimmed === w) return 200;
    const parts = glossTokens(gloss);
    if (parts[0] === w) return 100;
  }
  return 0;
}

function glossMatchScore(glosses: string[], word: string): number {
  const w = word.toLowerCase();
  let best = 0;

  for (const gloss of glosses) {
    const trimmed = gloss.toLowerCase().trim();
    if (trimmed === w) {
      best = Math.max(best, 1000);
      continue;
    }

    const parts = glossTokens(gloss);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] !== w) continue;
      if (parts.length === 1) {
        best = Math.max(best, 1000);
      } else if (i === 0) {
        best = Math.max(best, 850);
      } else {
        best = Math.max(best, 700 - i * 30);
      }
    }
  }

  return best;
}

function senseRank(entry: CedictEntry, word: string): number {
  const score = glossMatchScore(entry.glosses, word);
  if (score < 700) return score;

  let rank = score + primaryGlossBoost(entry.glosses, word);

  const w = word.toLowerCase();
  const firstGloss = entry.glosses[0]?.toLowerCase() ?? "";
  if (entry.traditional.length === 1 && !firstGloss.startsWith(w)) {
    rank -= 250;
  }

  return rank;
}

function dedupeSubsumed(headwords: string[]): string[] {
  const sorted = [...headwords].sort((a, b) => a.length - b.length);
  const kept: string[] = [];

  for (const h of sorted) {
    if (kept.some((k) => h !== k && h.includes(k))) continue;
    kept.push(h);
  }

  return kept;
}

function entriesForQuery(english: string): CedictEntry[] {
  const word = english.toLowerCase().trim();
  if (!word) return [];

  const keys = word.includes(" ") ? phraseLookupKeys(word) : [word];
  const { reverse } = loadIndex();
  const out: CedictEntry[] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    for (const entry of reverse.get(key) ?? []) {
      if (seen.has(entry.traditional)) continue;
      seen.add(entry.traditional);
      out.push(entry);
    }
  }

  return out;
}

function lookupCedictGlosses(english: string, limit = 5): string[] {
  const word = english.toLowerCase().trim();
  if (!word) return [];

  const entries = entriesForQuery(word);
  if (!entries.length) {
    const phraseZh = lookupPhraseZh(word);
    return phraseZh ? [phraseZh] : [];
  }

  const scored = entries
    .map((entry) => ({
      traditional: entry.traditional,
      score: senseRank(entry, word),
    }))
    .filter((e) => e.score >= 700)
    .sort((a, b) => b.score - a.score || a.traditional.length - b.traditional.length);

  const headwords = dedupeSubsumed(scored.map((e) => e.traditional));
  return headwords.slice(0, limit);
}

// Look up a human-curated 香港繁體 gloss for an English word or short phrase.
export function lookupCedict(english: string): string | null {
  const glosses = lookupCedictGlosses(english, 4);
  if (glosses.length) return glosses.join("、");

  const phraseZh = lookupPhraseZh(english);
  return phraseZh ?? null;
}

const GLOSS_WORD_RE = /^[a-z][a-z'-]*$/;

function glossesForRelated(entry: CedictEntry): string[] {
  const out: string[] = [];
  for (const gloss of entry.glosses) {
    for (const token of glossTokens(gloss)) {
      if (GLOSS_WORD_RE.test(token)) out.push(token);
    }
  }
  return out;
}

// English words that share CC-CEDICT entries with this headword (e.g. bank → shore, levee).
export function findRelatedWords(english: string, limit = 6): string[] {
  const word = english.toLowerCase().trim();
  if (!word) return [];

  const { byTraditional } = loadIndex();
  const headwords = lookupCedictGlosses(word, 6);
  if (!headwords.length) return [];

  const scores = new Map<string, number>();

  for (const trad of headwords) {
    const entry = byTraditional.get(trad);
    if (!entry) continue;

    for (const gloss of glossesForRelated(entry)) {
      if (gloss === word) continue;
      const prev = scores.get(gloss) ?? 0;
      scores.set(gloss, prev + wordFrequency(gloss));
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
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

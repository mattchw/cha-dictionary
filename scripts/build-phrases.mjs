import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cedictPath = join(root, "data", "cedict.txt");
const outDir = join(root, "data");
const LINE_RE = /^(\S+)\s+(\S+)\s+\[[^\]]*\]\s+\/(.+)\/$/;
const PHRASE_RE = /^[a-z0-9][a-z0-9' -]*[a-z0-9]$/i;
const SKIP_RE = /\b(sb|sth|esp|etc)\b|\(|\)|\.{3}|^variant |^old variant /i;

const CHIP_VERBS = [
  "look", "give", "take", "get", "put", "break", "come", "go", "turn", "find",
  "keep", "hold", "run", "set", "work", "pick", "carry", "bring", "fall", "make",
];

function canonicalPhrase(gloss) {
  const key = gloss.toLowerCase().trim();
  return key.startsWith("to ") ? key.slice(3) : key;
}

function isValidPhrase(gloss) {
  const key = gloss.toLowerCase().trim();
  if (!key.includes(" ")) return false;
  if (key.length > 40 || key.length < 5) return false;
  if (!PHRASE_RE.test(key)) return false;
  if (SKIP_RE.test(key)) return false;
  const words = key.split(/\s+/).length;
  return words >= 2 && words <= 4;
}

function scorePhrase(phrase) {
  const words = phrase.split(/\s+/).length;
  return 100 - words * 12 - phrase.length * 0.3;
}

const byPhrase = new Map();

for (const line of readFileSync(cedictPath, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const m = line.match(LINE_RE);
  if (!m) continue;

  const traditional = m[1];
  for (const gloss of m[3].split("/").filter(Boolean)) {
    if (!isValidPhrase(gloss)) continue;

    const canonical = canonicalPhrase(gloss);
    const prev = byPhrase.get(canonical);
    const nextScore = scorePhrase(canonical);
    if (!prev || nextScore > prev.score || traditional.length < prev.zh.length) {
      byPhrase.set(canonical, { phrase: canonical, zh: traditional, score: nextScore });
    }
  }
}

const phrases = [...byPhrase.values()].sort((a, b) => a.phrase.localeCompare(b.phrase));
const zhMap = Object.fromEntries(phrases.map((p) => [p.phrase, p.zh]));

const chips = phrases
  .filter((p) => {
    const w = p.phrase.split(/\s+/);
    return w.length === 2 && CHIP_VERBS.includes(w[0]);
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 80)
  .map((p) => ({ phrase: p.phrase, zh: p.zh }));

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "phrases.json"),
  JSON.stringify({ phrases: phrases.map((p) => p.phrase), zh: zhMap })
);
writeFileSync(join(outDir, "phrasal-chips.json"), JSON.stringify(chips));

console.log(`Wrote ${phrases.length} phrases to data/phrases.json`);
console.log(`Wrote ${chips.length} phrasal chips to data/phrasal-chips.json`);

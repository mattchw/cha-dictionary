import type { DictEntry } from "./types";

export function formatEntryAsText(entry: DictEntry): string {
  const lines: string[] = [entry.word];

  if (entry.phonetic) lines.push(entry.phonetic);
  if (entry.wordZh) lines.push(entry.wordZh);
  if (entry.cefr) lines.push(`CEFR ${entry.cefr}`);
  lines.push("");

  for (const m of entry.meanings) {
    lines.push(m.partOfSpeech);
    for (const d of m.definitions) {
      lines.push(`· ${d.en}`);
      if (d.zh) lines.push(`  ${d.zh}`);
      if (d.example) {
        lines.push(`  “${d.example}”`);
        if (d.exampleZh) lines.push(`  ${d.exampleZh}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

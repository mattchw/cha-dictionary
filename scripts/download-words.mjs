#!/usr/bin/env node
// Fetches word list, frequency rankings, CC-CEDICT, and CEFR level data.
import { mkdir, writeFile } from "fs/promises";
import { gunzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

const textSources = [
  {
    url: "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
    out: join(root, "words.txt"),
    label: "word list",
  },
  {
    url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt",
    out: join(root, "frequency.txt"),
    label: "frequency list",
  },
];

const cedict = {
  url: "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
  out: join(root, "cedict.txt"),
  label: "CC-CEDICT",
};

const cefrSources = [
  {
    url: "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv",
    label: "CEFR-J 1.5 (A1–B2)",
    levels: ["A1", "A2", "B1", "B2"],
  },
  {
    url: "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
    label: "Octanove C1/C2",
    levels: ["C1", "C2"],
  },
];

const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

function addLevel(map, word, level) {
  const w = word.trim().toLowerCase();
  if (!/^[a-z]+$/.test(w)) return;
  const existing = map.get(w);
  if (!existing || LEVEL_RANK[level] > LEVEL_RANK[existing]) {
    map.set(w, level);
  }
}

function buildCefrLevels(csvParts) {
  const map = new Map();

  for (const { csv, levels } of csvParts) {
    const levelPattern = levels.join("|");
    for (const line of csv.trim().split(/\r?\n/).slice(1)) {
      const match = line.match(new RegExp(`^([^,]+),[^,]+,(${levelPattern}),`));
      if (!match) continue;
      addLevel(map, match[1], match[2]);
    }
  }

  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

await mkdir(root, { recursive: true });

for (const { url, out, label } of textSources) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label} (${res.status})`);
  await writeFile(out, await res.text());
  console.log(`Wrote ${out}`);
}

{
  const csvParts = [];
  for (const source of cefrSources) {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to download ${source.label} (${res.status})`);
    csvParts.push({ csv: await res.text(), levels: source.levels });
    console.log(`Fetched ${source.label}`);
  }

  const levels = buildCefrLevels(csvParts);
  const c1c2Words = Object.entries(levels)
    .filter(([, level]) => level === "C1" || level === "C2")
    .map(([word, level]) => ({ word, level }));

  await writeFile(join(root, "cefr-levels.json"), JSON.stringify(levels) + "\n");
  await writeFile(join(root, "c1c2-words.json"), JSON.stringify(c1c2Words, null, 2) + "\n");
  console.log(
    `Wrote ${join(root, "cefr-levels.json")} (${Object.keys(levels).length} words, A1–C2)`
  );
  console.log(`Wrote ${join(root, "c1c2-words.json")} (${c1c2Words.length} chip words)`);
}

{
  const res = await fetch(cedict.url);
  if (!res.ok) throw new Error(`Failed to download ${cedict.label} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cedict.out, gunzipSync(buf));
  console.log(`Wrote ${cedict.out}`);
}

#!/usr/bin/env node
// Fetches word list, frequency rankings, CC-CEDICT, and C1/C2 vocabulary for chips.
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

const c1c2 = {
  url: "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
  out: join(root, "c1c2-words.json"),
  label: "C1/C2 vocabulary (Octanove / CEFR-J)",
};

function parseC1C2Words(csv) {
  const words = [];
  const seen = new Set();

  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const match = line.match(/^([^,]+),[^,]+,(C1|C2),/);
    if (!match) continue;

    const word = match[1].trim().toLowerCase();
    if (!/^[a-z]+$/.test(word) || seen.has(word)) continue;

    seen.add(word);
    words.push(word);
  }

  words.sort();
  return words;
}

await mkdir(root, { recursive: true });

for (const { url, out, label } of textSources) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label} (${res.status})`);
  await writeFile(out, await res.text());
  console.log(`Wrote ${out}`);
}

{
  const res = await fetch(c1c2.url);
  if (!res.ok) throw new Error(`Failed to download ${c1c2.label} (${res.status})`);
  const words = parseC1C2Words(await res.text());
  await writeFile(c1c2.out, JSON.stringify(words, null, 2) + "\n");
  console.log(`Wrote ${c1c2.out} (${words.length} words)`);
}

{
  const res = await fetch(cedict.url);
  if (!res.ok) throw new Error(`Failed to download ${cedict.label} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cedict.out, gunzipSync(buf));
  console.log(`Wrote ${cedict.out}`);
}

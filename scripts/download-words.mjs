#!/usr/bin/env node
// Fetches word list, frequency rankings, and CC-CEDICT for autocomplete + Chinese glosses.
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

await mkdir(root, { recursive: true });

for (const { url, out, label } of textSources) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label} (${res.status})`);
  await writeFile(out, await res.text());
  console.log(`Wrote ${out}`);
}

{
  const res = await fetch(cedict.url);
  if (!res.ok) throw new Error(`Failed to download ${cedict.label} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cedict.out, gunzipSync(buf));
  console.log(`Wrote ${cedict.out}`);
}

import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "data");
const files = ["frequency.txt", "cefr-levels.json", "c1c2-words.json"];

mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const src = join(root, "data", file);
  if (!existsSync(src)) {
    console.warn(`skip ${file} (missing — run npm run download-words)`);
    continue;
  }
  copyFileSync(src, join(outDir, file));
}

console.log(`Copied ${files.length} data files to public/data/`);

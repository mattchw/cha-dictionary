import { readFileSync } from "fs";
import { join } from "path";
import type { CefrLevel } from "@/lib/types";

let levels: Record<string, CefrLevel> | null = null;

function loadLevels(): Record<string, CefrLevel> {
  if (levels) return levels;
  const file = join(process.cwd(), "data", "cefr-levels.json");
  levels = JSON.parse(readFileSync(file, "utf8")) as Record<string, CefrLevel>;
  return levels;
}

export function lookupCefrLevel(word: string): CefrLevel | null {
  return loadLevels()[word.toLowerCase()] ?? null;
}

import { lookupCedict } from "./cedict";
import { fillMissingTranslations } from "./translate";

export async function translateOneString(text: string): Promise<string | null> {
  const hit = lookupCedict(text);
  if (hit) return hit;

  const out: (string | null)[] = [null];
  await fillMissingTranslations(out, [text]);
  return out[0];
}

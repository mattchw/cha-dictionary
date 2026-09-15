import { INITIAL_DEFS_PER_MEANING } from "./dictionary-constants";
import type { DictEntry } from "./types";
import type { TranslationSlot, TranslateStreamEvent } from "./translate-stream-types";

export function collectTranslationSlots(
  entry: DictEntry,
  opts: {
    defsPerMeaning?: number;
    meaningIndex?: number;
    fromDefIndex?: number;
  } = {}
): TranslationSlot[] {
  const defsPerMeaning = opts.defsPerMeaning ?? INITIAL_DEFS_PER_MEANING;
  const slots: TranslationSlot[] = [];

  const meaningOnly = opts.meaningIndex !== undefined;
  if (!meaningOnly) {
    slots.push({ kind: "wordZh" });
  }

  entry.meanings.forEach((m, mi) => {
    if (meaningOnly && mi !== opts.meaningIndex) return;

    const from = meaningOnly ? (opts.fromDefIndex ?? 0) : 0;
    const limit = meaningOnly ? m.definitions.length : defsPerMeaning;

    m.definitions.slice(from, limit).forEach((d, offset) => {
      const di = from + offset;
      slots.push({ kind: "defZh", mi, di, text: d.en });
      if (d.example) {
        slots.push({ kind: "exampleZh", mi, di, text: d.example });
      }
    });
  });

  return slots;
}

export function entryToStreamEvents(entry: DictEntry): TranslateStreamEvent[] {
  const events: TranslateStreamEvent[] = [];
  if (entry.wordZh) events.push({ type: "wordZh", value: entry.wordZh });

  entry.meanings.forEach((m, mi) => {
    m.definitions.forEach((d, di) => {
      if (d.zh) events.push({ type: "defZh", mi, di, value: d.zh });
      if (d.exampleZh) events.push({ type: "exampleZh", mi, di, value: d.exampleZh });
    });
  });

  events.push({ type: "done", entry });
  return events;
}

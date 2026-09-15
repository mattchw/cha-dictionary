import { NextRequest } from "next/server";
import { INITIAL_DEFS_PER_MEANING } from "@/lib/dictionary-constants";
import { findRelatedWords } from "@/lib/cedict";
import { translateOneString } from "@/lib/translate-one";
import {
  collectTranslationSlots,
  entryToStreamEvents,
} from "@/lib/translation-slots";
import type { TranslateStreamEvent } from "@/lib/translate-stream-types";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { DictEntry } from "@/lib/types";

export const runtime = "nodejs";

function encode(event: TranslateStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(req: NextRequest) {
  let body: {
    entry?: DictEntry;
    defsPerMeaning?: number;
    meaningIndex?: number;
    fromDefIndex?: number;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const entry = body.entry;
  if (!entry?.word?.trim()) {
    return new Response(JSON.stringify({ error: "missing_entry" }), { status: 400 });
  }

  const defsPerMeaning = body.defsPerMeaning ?? INITIAL_DEFS_PER_MEANING;
  const meaningIndex = body.meaningIndex;
  const fromDefIndex = body.fromDefIndex ?? 0;
  const isSlice = meaningIndex !== undefined;
  const lc = entry.word.toLowerCase();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!isSlice) {
          const cached = cacheGet<DictEntry>(`full:${lc}`);
          if (cached?.wordZh) {
            for (const event of entryToStreamEvents(cached)) {
              controller.enqueue(encode(event));
            }
            controller.close();
            return;
          }
        }

        const slots = collectTranslationSlots(entry, {
          defsPerMeaning,
          meaningIndex,
          fromDefIndex,
        });

        let wordZh = entry.wordZh ?? null;
        const meanings = entry.meanings.map((m) => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.map((d) => ({ ...d })),
        }));

        for (const slot of slots) {
          if (slot.kind === "wordZh") {
            wordZh = await translateOneString(entry.word);
            controller.enqueue(encode({ type: "wordZh", value: wordZh }));
            continue;
          }

          const value = await translateOneString(slot.text);
          if (slot.kind === "defZh") {
            meanings[slot.mi].definitions[slot.di] = {
              ...meanings[slot.mi].definitions[slot.di],
              zh: value,
            };
            controller.enqueue(
              encode({ type: "defZh", mi: slot.mi, di: slot.di, value })
            );
          } else {
            meanings[slot.mi].definitions[slot.di] = {
              ...meanings[slot.mi].definitions[slot.di],
              exampleZh: value,
            };
            controller.enqueue(
              encode({ type: "exampleZh", mi: slot.mi, di: slot.di, value })
            );
          }
        }

        const merged: DictEntry = isSlice
          ? {
              ...entry,
              meanings: entry.meanings.map((m, i) =>
                i === meaningIndex ? meanings[meaningIndex] : m
              ),
            }
          : {
              ...entry,
              wordZh,
              meanings,
              relatedWords: entry.relatedWords ?? findRelatedWords(entry.word),
            };

        cacheSet(`full:${lc}`, merged);
        controller.enqueue(encode({ type: "done", entry: merged }));
        controller.close();
      } catch {
        controller.error(new Error("translate_stream_failed"));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

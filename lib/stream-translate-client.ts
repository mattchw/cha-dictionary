import type { DictEntry } from "./types";
import type { TranslateStreamEvent } from "./translate-stream-types";

export type StreamTranslateOptions = {
  entry: DictEntry;
  defsPerMeaning?: number;
  meaningIndex?: number;
  fromDefIndex?: number;
  onEvent: (event: TranslateStreamEvent) => void;
  isCancelled?: () => boolean;
};

export async function streamTranslate(opts: StreamTranslateOptions): Promise<boolean> {
  const res = await fetch("/api/translate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry: opts.entry,
      defsPerMeaning: opts.defsPerMeaning,
      meaningIndex: opts.meaningIndex,
      fromDefIndex: opts.fromDefIndex,
    }),
  });

  if (!res.ok || !res.body) return false;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (opts.isCancelled?.()) return false;

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as TranslateStreamEvent;
      opts.onEvent(event);
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as TranslateStreamEvent;
    opts.onEvent(event);
  }

  return true;
}

export function applyStreamEvent(
  entry: DictEntry,
  event: TranslateStreamEvent
): DictEntry {
  if (event.type === "wordZh") {
    return { ...entry, wordZh: event.value };
  }
  if (event.type === "defZh") {
    return {
      ...entry,
      meanings: entry.meanings.map((m, mi) =>
        mi !== event.mi
          ? m
          : {
              ...m,
              definitions: m.definitions.map((d, di) =>
                di !== event.di ? d : { ...d, zh: event.value }
              ),
            }
      ),
    };
  }
  if (event.type === "exampleZh") {
    return {
      ...entry,
      meanings: entry.meanings.map((m, mi) =>
        mi !== event.mi
          ? m
          : {
              ...m,
              definitions: m.definitions.map((d, di) =>
                di !== event.di ? d : { ...d, exampleZh: event.value }
              ),
            }
      ),
    };
  }
  return event.entry;
}

import type { DictEntry } from "./types";

export type TranslateStreamEvent =
  | { type: "wordZh"; value: string | null }
  | { type: "defZh"; mi: number; di: number; value: string | null }
  | { type: "exampleZh"; mi: number; di: number; value: string | null }
  | { type: "done"; entry: DictEntry };

export type TranslationSlot =
  | { kind: "wordZh" }
  | { kind: "defZh"; mi: number; di: number; text: string }
  | { kind: "exampleZh"; mi: number; di: number; text: string };

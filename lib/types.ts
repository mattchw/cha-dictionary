export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface Definition {
  en: string;
  example: string | null;
  zh?: string | null;
  exampleZh?: string | null;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

export interface DictEntry {
  word: string;
  phonetic: string | null;
  audio: string | null;
  wordZh?: string | null;
  cefr?: CefrLevel | null;
  meanings: Meaning[];
}

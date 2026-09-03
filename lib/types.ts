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
  meanings: Meaning[];
}

"use client";

import {
  isLinkableToken,
  normalizeLookupWord,
  splitLinkableText,
} from "@/lib/linkable-text";

type LinkableTextProps = {
  text: string;
  headword: string;
  onLookup: (word: string) => void;
};

export function LinkableText({ text, headword, onLookup }: LinkableTextProps) {
  const parts = splitLinkableText(text);

  return (
    <>
      {parts.map((part, i) => {
        if (!part || !isLinkableToken(part, headword)) {
          return <span key={i}>{part}</span>;
        }

        const word = normalizeLookupWord(part);
        return (
          <button
            key={i}
            type="button"
            className="dc-def-link"
            onClick={() => onLookup(word)}
            title={`Look up “${word}”`}
          >
            {part}
          </button>
        );
      })}
    </>
  );
}

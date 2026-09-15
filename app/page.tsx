"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Volume2, Loader2, X, Copy, Shuffle } from "lucide-react";
import type { DictEntry, WordOfDay } from "@/lib/types";
import { pickRandomChips, cefrBadgeClass, type ChipWord } from "@/lib/c2-words";
import { LinkableText } from "@/components/linkable-text";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getCachedEntry,
  saveCachedEntry,
  listRecentEntries,
} from "@/lib/offline-cache";
import { offlineSuggest } from "@/lib/offline-suggest";
import { getWordOfDayClient } from "@/lib/word-of-day-client";

const CHIP_COUNT = 4;
type Status = "idle" | "loading" | "done" | "notfound" | "error";

function highlightPrefix(word: string, prefix: string) {
  const n = prefix.length;
  if (n === 0) return <>{word}</>;
  return (
    <>
      <span className="dc-suggest-match">{word.slice(0, n)}</span>
      <span className="dc-suggest-rest">{word.slice(n)}</span>
    </>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [entry, setEntry] = useState<DictEntry | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [translating, setTranslating] = useState(false);
  const [zhFailed, setZhFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [chipWords, setChipWords] = useState<ChipWord[]>([]);
  const [wordOfDay, setWordOfDay] = useState<WordOfDay | null>(null);
  const [recentEntries, setRecentEntries] = useState<DictEntry[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [copied, setCopied] = useState(false);
  const reqRef = useRef(0);
  const suggestRef = useRef(0);
  const suppressSuggestRef = useRef(false);
  const bootedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshRecent() {
    const recent = await listRecentEntries();
    setRecentEntries(recent);
  }

  useEffect(() => {
    setChipWords(pickRandomChips(CHIP_COUNT));
    setWordOfDay(getWordOfDayClient());
    void refreshRecent();

    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (navigator.onLine) {
      void fetch("/api/word-of-the-day")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.word) setWordOfDay(data as WordOfDay);
        })
        .catch(() => {});
    }

    if (!bootedRef.current) {
      bootedRef.current = true;
      const word = new URLSearchParams(window.location.search).get("word")?.trim();
      if (word) void lookup(word);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function setWordInUrl(word: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("word", word);
    window.history.replaceState(null, "", url);
  }

  function clearWordFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("word");
    const next = url.pathname + (url.search || "");
    window.history.replaceState(null, "", next);
  }

  function goHome() {
    reqRef.current++;
    suggestRef.current++;
    suppressSuggestRef.current = false;
    setInput("");
    setEntry(null);
    setStatus("idle");
    setTranslating(false);
    setZhFailed(false);
    setFromCache(false);
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIndex(-1);
    setCopied(false);
    clearWordFromUrl();
    inputRef.current?.focus();
  }

  function shuffleChips() {
    setChipWords(pickRandomChips(CHIP_COUNT));
  }

  async function copyHeadword() {
    if (!entry) return;
    try {
      await navigator.clipboard.writeText(entry.word);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  useEffect(() => {
    if (suppressSuggestRef.current) return;

    const q = input.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      setActiveIndex(-1);
      return;
    }

    const id = ++suggestRef.current;
    const timer = setTimeout(async () => {
      try {
        let items: string[];
        if (!navigator.onLine) {
          items = await offlineSuggest(q, 8);
        } else {
          const res = await fetch(
            `/api/suggest?q=${encodeURIComponent(q)}&limit=8`
          );
          if (suggestRef.current !== id) return;
          if (!res.ok) {
            items = await offlineSuggest(q, 8);
          } else {
            const data = (await res.json()) as { suggestions: string[] };
            items = data.suggestions;
          }
        }
        if (suggestRef.current !== id) return;
        setSuggestions(items);
        setSuggestOpen(items.length > 0);
        setActiveIndex(-1);
      } catch {
        if (suggestRef.current === id) {
          setSuggestions([]);
          setSuggestOpen(false);
        }
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [input]);

  async function loadTranslation(eng: DictEntry, id: number) {
    setTranslating(true);
    try {
      const tRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: eng }),
      });
      if (reqRef.current !== id) return;
      if (tRes.ok) {
        const merged: DictEntry = await tRes.json();
        if (reqRef.current === id) {
          setEntry(merged);
          setFromCache(false);
          await saveCachedEntry(merged);
          void refreshRecent();
        }
      } else {
        setZhFailed(true);
      }
    } catch {
      if (reqRef.current === id) setZhFailed(true);
    } finally {
      if (reqRef.current === id) setTranslating(false);
    }
  }

  async function lookup(term?: string) {
    const word = (term ?? input).trim();
    if (!word) return;
    const id = ++reqRef.current;

    suppressSuggestRef.current = true;
    suggestRef.current++;
    setInput(word);
    setActiveIndex(-1);
    setSuggestOpen(false);
    setSuggestions([]);
    setZhFailed(false);
    setFromCache(false);
    setEntry(null);
    setTranslating(false);
    setStatus("loading");
    window.scrollTo({ top: 0, behavior: "smooth" });

    const lc = word.toLowerCase();

    if (!navigator.onLine) {
      const cached = await getCachedEntry(lc);
      if (reqRef.current !== id) return;
      if (cached?.wordZh) {
        setEntry(cached);
        setFromCache(true);
        setStatus("done");
        setWordInUrl(cached.word);
        return;
      }
      return setStatus("error");
    }

    try {
      const res = await fetch(`/api/entry?word=${encodeURIComponent(word)}`);
      if (reqRef.current !== id) return;
      if (res.status === 404) return setStatus("notfound");
      if (!res.ok) throw new Error("lookup_failed");

      const eng: DictEntry = await res.json();
      if (reqRef.current !== id) return;
      setEntry(eng);
      setStatus("done");
      setWordInUrl(eng.word);

      void loadTranslation(eng, id);
    } catch {
      if (reqRef.current !== id) return;
      const cached = await getCachedEntry(lc);
      if (cached?.wordZh) {
        setEntry(cached);
        setFromCache(true);
        setStatus("done");
        setWordInUrl(cached.word);
        return;
      }
      setStatus("error");
    }
  }

  function selectSuggestion(word: string) {
    setSuggestOpen(false);
    setSuggestions([]);
    lookup(word);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) {
      if (e.key === "Enter") lookup();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) selectSuggestion(suggestions[activeIndex]);
      else lookup();
    }
  }

  function playAudio() {
    if (entry?.audio) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = entry.audio;
      audioRef.current.play().catch(() => speak());
    } else {
      speak();
    }
  }

  function speak() {
    if (!entry || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(entry.word);
    u.lang = "en-GB";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  const prefix = input.trim().toLowerCase();

  return (
    <div className="dc-wrap">
      <header className="dc-head">
        <button
          type="button"
          className="dc-mark"
          onClick={goHome}
          aria-label="Back to home"
        >
          查
        </button>
        <div className="dc-head-main">
          <h1 className="dc-title">英漢詞典</h1>
          <p className="dc-sub">English · 香港繁體</p>
        </div>
        <div className="dc-head-actions">
          {!isOnline && <span className="dc-offline-badge">Offline</span>}
          <ThemeToggle />
        </div>
      </header>

      <div className="dc-searchrow">
        <div className={`dc-searchbox${suggestOpen ? " is-open" : ""}`}>
          <Search className="dc-searchicon" size={20} strokeWidth={2} aria-hidden="true" />
          <input
            ref={inputRef}
            className="dc-input"
            value={input}
            placeholder="Look up a word…"
            spellCheck={false}
            autoFocus
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestOpen}
            aria-controls="word-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
            }
            onChange={(e) => {
              suppressSuggestRef.current = false;
              setInput(e.target.value);
            }}
            onKeyDown={onInputKeyDown}
            onFocus={() => {
              if (!suppressSuggestRef.current && suggestions.length > 0) {
                setSuggestOpen(true);
              }
            }}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
          />
          {input && (
            <button
              type="button"
              className="dc-clear"
              onClick={() => {
                suppressSuggestRef.current = false;
                setInput("");
                setSuggestOpen(false);
                setSuggestions([]);
                clearWordFromUrl();
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={2.25} />
            </button>
          )}
          <button type="button" className="dc-go" onClick={() => lookup()}>
            Look up
          </button>
          {suggestOpen && suggestions.length > 0 && (
            <ul className="dc-suggest" id="word-suggestions" role="listbox">
              {suggestions.map((word, i) => (
                <li key={word} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    id={`suggestion-${i}`}
                    className={`dc-suggest-item${i === activeIndex ? " is-active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(word)}
                  >
                    {highlightPrefix(word, prefix)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {status === "idle" && (
        <div className="dc-empty">
          <p className="dc-empty-lead">
            Type an English word to see its meaning, an example, and its 香港繁體 translation.
          </p>
          {wordOfDay && (
            <div className="dc-wotd">
              <p className="dc-wotd-label">Word of the day</p>
              <button
                type="button"
                className="dc-wotd-card"
                onClick={() => lookup(wordOfDay.word)}
              >
                <span className="dc-wotd-word">{wordOfDay.word}</span>
                {wordOfDay.cefr && (
                  <span className={cefrBadgeClass(wordOfDay.cefr)}>{wordOfDay.cefr}</span>
                )}
              </button>
            </div>
          )}
          {recentEntries.length > 0 && (
            <div className="dc-recent">
              <p className="dc-recent-label">
                {isOnline ? "Recent lookups" : "Saved offline"}
              </p>
              <div className="dc-recent-chips">
                {recentEntries.map((item) => (
                  <button
                    key={item.word}
                    type="button"
                    className="dc-recent-chip"
                    onClick={() => lookup(item.word)}
                  >
                    {item.word}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="dc-chips-head">
            <p className="dc-chips-label">Try an advanced word</p>
            <button
              type="button"
              className="dc-shuffle"
              onClick={shuffleChips}
              aria-label="Shuffle suggestions"
            >
              <Shuffle size={15} strokeWidth={2.25} />
              Shuffle
            </button>
          </div>
          <div className="dc-chips">
            {chipWords.map((chip) => (
              <button
                key={chip.word}
                className="dc-chip"
                onClick={() => lookup(chip.word)}
              >
                <span className={cefrBadgeClass(chip.level)}>
                  {chip.level}
                </span>
                {chip.word}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="dc-note"><Loader2 className="dc-spin" size={16} /> Looking up…</div>
      )}

      {status === "notfound" && (
        <div className="dc-empty">
          <p className="dc-empty-lead">No entry found for “{input}”. Check the spelling, or try another word.</p>
        </div>
      )}

      {status === "error" && (
        <div className="dc-empty">
          <p className="dc-empty-lead">
            {!isOnline
              ? "This word isn’t saved offline yet. Look it up while connected, then it’ll be available on the MTR."
              : "The lookup didn’t go through. Try again in a moment."}
          </p>
        </div>
      )}

      {status === "done" && entry && (
        <article className="dc-result">
          {fromCache && (
            <p className="dc-cached-note">Showing a saved offline lookup.</p>
          )}
          <div className="dc-wordrow">
            <div>
              <div className="dc-wordline">
                <h2 className="dc-word">{entry.word}</h2>
                {entry.cefr && (
                  <span className={cefrBadgeClass(entry.cefr)}>{entry.cefr}</span>
                )}
              </div>
              {entry.phonetic && <span className="dc-phon">{entry.phonetic}</span>}
            </div>
            <div className="dc-word-actions">
              <button
                type="button"
                className={`dc-copy${copied ? " is-done" : ""}`}
                onClick={() => void copyHeadword()}
                aria-label={copied ? "Copied" : "Copy word"}
              >
                <Copy size={18} strokeWidth={2.25} />
              </button>
              <button className="dc-audio" onClick={playAudio} aria-label="Play pronunciation">
                <Volume2 size={20} strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div className="dc-wordzh">
            {entry.wordZh ? (
              <span className="dc-zh dc-word-gloss">{entry.wordZh}</span>
            ) : translating ? (
              <span className="dc-pending">翻譯中…</span>
            ) : null}
          </div>

          {entry.relatedWords && entry.relatedWords.length > 0 && (
            <div className="dc-related">
              <p className="dc-related-label">Related words</p>
              <div className="dc-related-chips">
                {entry.relatedWords.map((word) => (
                  <button
                    key={word}
                    type="button"
                    className="dc-related-chip"
                    onClick={() => lookup(word)}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {zhFailed && <p className="dc-zh-fail">翻譯暫時無法載入，只顯示英文。</p>}

          <div className="dc-senses">
            {entry.meanings.map((m, mi) => (
              <section className="dc-sense" key={mi}>
                <h3 className="dc-pos">{m.partOfSpeech}</h3>
                <ol className="dc-defs">
                  {m.definitions.map((d, di) => (
                    <li className="dc-def" key={di}>
                      <p className="dc-def-en">
                        <LinkableText
                          text={d.en}
                          headword={entry.word}
                          onLookup={lookup}
                        />
                      </p>
                      {d.zh ? (
                        <p className="dc-def-zh dc-zh">{d.zh}</p>
                      ) : translating ? (
                        <p className="dc-def-zh dc-zh"><span className="dc-pending">翻譯中…</span></p>
                      ) : null}
                      {d.example && (
                        <div className="dc-ex">
                          <p className="dc-ex-en">
                            “
                            <LinkableText
                              text={d.example}
                              headword={entry.word}
                              onLookup={lookup}
                            />
                            ”
                          </p>
                          {d.exampleZh ? (
                            <p className="dc-ex-zh dc-zh">{d.exampleZh}</p>
                          ) : translating ? (
                            <p className="dc-ex-zh dc-zh"><span className="dc-pending">翻譯中…</span></p>
                          ) : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </article>
      )}

      <footer className="dc-foot">
        English definitions from Wiktionary · Chinese glosses from CC-CEDICT
      </footer>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Volume2, X, Copy, Shuffle } from "lucide-react";
import { LoadingSkeleton, SkelLine } from "@/components/skeleton";
import type { DictEntry, WordOfDay } from "@/lib/types";
import { pickRandomChips, cefrBadgeClass, type ChipWord } from "@/lib/c2-words";
import { pickRandomPhrasalChips, type PhrasalChip } from "@/lib/phrasal-chips";
import { LinkableText } from "@/components/linkable-text";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getCachedEntry,
  saveCachedEntry,
  listRecentEntries,
} from "@/lib/offline-cache";
import { offlineSuggest } from "@/lib/offline-suggest";
import { getWordOfDayClient } from "@/lib/word-of-day-client";
import { spellSuggestClient } from "@/lib/spell-suggest-client";
import { INITIAL_DEFS_PER_MEANING } from "@/lib/dictionary-constants";
import { applyStreamEvent, streamTranslate } from "@/lib/stream-translate-client";

const CHIP_COUNT = 4;
const PHRASAL_CHIP_COUNT = 4;
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
  const [phrasalChips, setPhrasalChips] = useState<PhrasalChip[]>([]);
  const [wordOfDay, setWordOfDay] = useState<WordOfDay | null>(null);
  const [recentEntries, setRecentEntries] = useState<DictEntry[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [copied, setCopied] = useState(false);
  const [spellSuggestions, setSpellSuggestions] = useState<string[]>([]);
  const [expandedMeanings, setExpandedMeanings] = useState<Set<number>>(new Set());
  const [expandingMeaning, setExpandingMeaning] = useState<number | null>(null);
  const reqRef = useRef(0);
  const suggestRef = useRef(0);
  const suppressSuggestRef = useRef(false);
  const skipHistoryRef = useRef(false);
  const bootedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  async function refreshRecent() {
    const recent = await listRecentEntries();
    setRecentEntries(recent);
  }

  useEffect(() => {
    setChipWords(pickRandomChips(CHIP_COUNT));
    setPhrasalChips(pickRandomPhrasalChips(PHRASAL_CHIP_COUNT));
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

    const onPopState = () => {
      const word = new URLSearchParams(window.location.search).get("word")?.trim();
      skipHistoryRef.current = true;
      if (word) void lookup(word);
      else resetToIdle();
    };
    window.addEventListener("popstate", onPopState);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && statusRef.current !== "idle") {
        goHome();
        return;
      }
      if (e.key === "/") {
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function pushWordInUrl(word: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("word", word);
    window.history.pushState({ word }, "", url);
  }

  function pushHomeInUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("word");
    const next = url.pathname + (url.search || "");
    window.history.pushState(null, "", next);
  }

  function syncWordInHistory(word: string) {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    const current = new URLSearchParams(window.location.search).get("word")?.toLowerCase();
    if (current === word.toLowerCase()) return;
    pushWordInUrl(word);
  }

  function replaceHomeInUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("word");
    const next = url.pathname + (url.search || "");
    window.history.replaceState(null, "", next);
  }

  function resetToIdle() {
    reqRef.current++;
    suggestRef.current++;
    suppressSuggestRef.current = false;
    setInput("");
    setEntry(null);
    setStatus("idle");
    setTranslating(false);
    setZhFailed(false);
    setFromCache(false);
    setSpellSuggestions([]);
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIndex(-1);
    setCopied(false);
    setEntryCopied(false);
    setExpandedMeanings(new Set());
    setExpandingMeaning(null);
    inputRef.current?.focus();
  }

  function goHome() {
    resetToIdle();
    pushHomeInUrl();
  }

  function shuffleChips() {
    setChipWords(pickRandomChips(CHIP_COUNT));
    setPhrasalChips(pickRandomPhrasalChips(PHRASAL_CHIP_COUNT));
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

  async function showMoreSenses(meaningIndex: number) {
    if (!entry || expandedMeanings.has(meaningIndex)) return;

    const hidden = entry.meanings[meaningIndex].definitions.slice(
      INITIAL_DEFS_PER_MEANING
    );
    if (!hidden.length) return;

    setExpandedMeanings((prev) => new Set(prev).add(meaningIndex));

    const needsTranslate = hidden.some((d) => !d.zh);
    if (!needsTranslate || !navigator.onLine) return;

    setExpandingMeaning(meaningIndex);
    try {
      await streamTranslate({
        entry,
        meaningIndex,
        fromDefIndex: INITIAL_DEFS_PER_MEANING,
        onEvent: (event) => {
          if (event.type === "done") {
            setEntry((prev) => {
              if (!prev) return event.entry;
              const meanings = prev.meanings.map((m, i) => {
                if (i !== meaningIndex) return m;
                return {
                  ...m,
                  definitions: m.definitions.map((d, di) =>
                    di < INITIAL_DEFS_PER_MEANING
                      ? d
                      : event.entry.meanings[i].definitions[di] ?? d
                  ),
                };
              });
              const updated = { ...prev, meanings };
              void saveCachedEntry(updated);
              return updated;
            });
          } else if (event.type !== "wordZh") {
            setEntry((prev) => (prev ? applyStreamEvent(prev, event) : prev));
          }
        },
      });
    } catch {
      // Extra senses stay English-only
    } finally {
      setExpandingMeaning(null);
    }
  }

  useEffect(() => {
    if (status !== "notfound" || !input.trim()) {
      setSpellSuggestions([]);
      return;
    }

    const q = input.trim();
    void (async () => {
      try {
        let items: string[];
        if (!navigator.onLine) {
          items = await spellSuggestClient(q);
        } else {
          const res = await fetch(`/api/spell?q=${encodeURIComponent(q)}&limit=3`);
          items = res.ok
            ? ((await res.json()) as { suggestions: string[] }).suggestions
            : await spellSuggestClient(q);
        }
        setSpellSuggestions(items);
      } catch {
        setSpellSuggestions([]);
      }
    })();
  }, [status, input]);

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
    setZhFailed(false);

    const ok = await streamTranslate({
      entry: eng,
      defsPerMeaning: INITIAL_DEFS_PER_MEANING,
      isCancelled: () => reqRef.current !== id,
      onEvent: (event) => {
        if (reqRef.current !== id) return;
        if (event.type === "done") {
          setEntry(event.entry);
          setFromCache(false);
          void saveCachedEntry(event.entry);
          void refreshRecent();
        } else {
          setEntry((prev) => (prev ? applyStreamEvent(prev, event) : prev));
        }
      },
    });

    if (reqRef.current === id) {
      if (!ok) setZhFailed(true);
      setTranslating(false);
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
    setSpellSuggestions([]);
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
        syncWordInHistory(cached.word);
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
      syncWordInHistory(eng.word);

      void loadTranslation(eng, id);
    } catch {
      if (reqRef.current !== id) return;
      const cached = await getCachedEntry(lc);
      if (cached?.wordZh) {
        setEntry(cached);
        setFromCache(true);
        setStatus("done");
        syncWordInHistory(cached.word);
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
                replaceHomeInUrl();
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
            Type a word or phrase — try <em>look up</em>, <em>give up</em>, or <em>on the other hand</em>.
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
          {phrasalChips.length > 0 && (
            <>
              <div className="dc-chips-head">
                <p className="dc-chips-label">Common phrases</p>
              </div>
              <div className="dc-chips dc-chips-phrasal">
                {phrasalChips.map((chip) => (
                  <button
                    key={chip.phrase}
                    type="button"
                    className="dc-chip"
                    onClick={() => lookup(chip.phrase)}
                  >
                    <span className="dc-phrase-badge">phrase</span>
                    {chip.phrase}
                  </button>
                ))}
              </div>
            </>
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

      {status === "loading" && <LoadingSkeleton />}

      {status === "notfound" && (
        <div className="dc-empty">
          <p className="dc-empty-lead">No entry found for “{input}”. Check the spelling, or try another word.</p>
          {spellSuggestions.length > 0 && (
            <div className="dc-spell">
              <p className="dc-spell-label">Did you mean</p>
              <div className="dc-spell-chips">
                {spellSuggestions.map((word) => (
                  <button
                    key={word}
                    type="button"
                    className="dc-spell-chip"
                    onClick={() => lookup(word)}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                {entry.isPhrase && (
                  <span className="dc-phrase-badge">phrase</span>
                )}
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
                title="Copy word"
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
              <SkelLine className="dc-skel-gloss-inline" />
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
            {entry.meanings.map((m, mi) => {
              const isExpanded = expandedMeanings.has(mi);
              const visibleDefs = isExpanded
                ? m.definitions
                : m.definitions.slice(0, INITIAL_DEFS_PER_MEANING);
              const hiddenCount = m.definitions.length - INITIAL_DEFS_PER_MEANING;

              return (
              <section className="dc-sense" key={mi}>
                <h3 className="dc-pos">{m.partOfSpeech}</h3>
                <ol className="dc-defs">
                  {visibleDefs.map((d, di) => (
                    <li
                      className={`dc-def${isExpanded && di >= INITIAL_DEFS_PER_MEANING ? " dc-def-new" : ""}`}
                      key={`${mi}-${di}-${d.en}`}
                    >
                      <p className="dc-def-en">
                        <LinkableText
                          text={d.en}
                          headword={entry.word}
                          onLookup={lookup}
                        />
                      </p>
                      {d.zh ? (
                        <p className="dc-def-zh dc-zh">{d.zh}</p>
                      ) : (translating || (expandingMeaning === mi && di >= INITIAL_DEFS_PER_MEANING)) && !d.zh ? (
                        <p className="dc-def-zh"><SkelLine className="dc-skel-def-zh-inline" /></p>
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
                          ) : (translating || (expandingMeaning === mi && di >= INITIAL_DEFS_PER_MEANING)) && !d.exampleZh ? (
                            <p className="dc-ex-zh"><SkelLine className="dc-skel-ex-zh-inline" /></p>
                          ) : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {hiddenCount > 0 && !isExpanded && (
                  <button
                    type="button"
                    className="dc-show-more"
                    onClick={() => void showMoreSenses(mi)}
                  >
                    Show {hiddenCount} more sense{hiddenCount === 1 ? "" : "s"}
                  </button>
                )}
              </section>
            );
            })}
          </div>
        </article>
      )}

      <footer className="dc-foot">
        English definitions from Wiktionary · Chinese glosses from CC-CEDICT
      </footer>
    </div>
  );
}

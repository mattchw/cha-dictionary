"use client";

import { useState, useRef } from "react";
import { Search, Volume2, Loader2 } from "lucide-react";
import type { DictEntry } from "@/lib/types";

const SUGGESTIONS = ["serendipity", "resilient", "nostalgia", "home"];
type Status = "idle" | "loading" | "done" | "notfound" | "error";

export default function Home() {
  const [input, setInput] = useState("");
  const [entry, setEntry] = useState<DictEntry | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [translating, setTranslating] = useState(false);
  const [zhFailed, setZhFailed] = useState(false);
  const reqRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        if (reqRef.current === id) setEntry(merged);
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

    setInput(word);
    setZhFailed(false);
    setEntry(null);
    setTranslating(false);
    setStatus("loading");

    try {
      const res = await fetch(`/api/entry?word=${encodeURIComponent(word)}`);
      if (reqRef.current !== id) return;
      if (res.status === 404) return setStatus("notfound");
      if (!res.ok) return setStatus("error");

      const eng: DictEntry = await res.json();
      if (reqRef.current !== id) return;
      setEntry(eng);
      setStatus("done");

      // Fire-and-forget: translation never blocks the English response.
      void loadTranslation(eng, id);
    } catch {
      if (reqRef.current === id) setStatus("error");
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

  return (
    <div className="dc-wrap">
      <header className="dc-head">
        <div className="dc-mark" aria-hidden="true">查</div>
        <div>
          <h1 className="dc-title">英漢詞典</h1>
          <p className="dc-sub">English · 香港繁體</p>
        </div>
      </header>

      <div className="dc-searchrow">
        <Search className="dc-searchicon" size={20} strokeWidth={2} />
        <input
          className="dc-input"
          value={input}
          placeholder="Look up a word…"
          spellCheck={false}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
        />
        <button className="dc-go" onClick={() => lookup()}>Look up</button>
      </div>

      {status === "idle" && (
        <div className="dc-empty">
          <p className="dc-empty-lead">
            Type an English word to see its meaning, an example, and its 香港繁體 translation.
          </p>
          <div className="dc-chips">
            {SUGGESTIONS.map((w) => (
              <button key={w} className="dc-chip" onClick={() => lookup(w)}>{w}</button>
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
          <p className="dc-empty-lead">The lookup didn’t go through. Try again in a moment.</p>
        </div>
      )}

      {status === "done" && entry && (
        <article className="dc-result">
          <div className="dc-wordrow">
            <div>
              <h2 className="dc-word">{entry.word}</h2>
              {entry.phonetic && <span className="dc-phon">{entry.phonetic}</span>}
            </div>
            <button className="dc-audio" onClick={playAudio} aria-label="Play pronunciation">
              <Volume2 size={20} strokeWidth={2.25} />
            </button>
          </div>

          <div className="dc-wordzh">
            {entry.wordZh ? (
              <span className="dc-zh dc-word-gloss">{entry.wordZh}</span>
            ) : translating ? (
              <span className="dc-pending">翻譯中…</span>
            ) : null}
          </div>

          {zhFailed && <p className="dc-zh-fail">翻譯暫時無法載入，只顯示英文。</p>}

          <div className="dc-senses">
            {entry.meanings.map((m, mi) => (
              <section className="dc-sense" key={mi}>
                <h3 className="dc-pos">{m.partOfSpeech}</h3>
                <ol className="dc-defs">
                  {m.definitions.map((d, di) => (
                    <li className="dc-def" key={di}>
                      <p className="dc-def-en">{d.en}</p>
                      {d.zh ? (
                        <p className="dc-def-zh dc-zh">{d.zh}</p>
                      ) : translating ? (
                        <p className="dc-def-zh dc-zh"><span className="dc-pending">翻譯中…</span></p>
                      ) : null}
                      {d.example && (
                        <div className="dc-ex">
                          <p className="dc-ex-en">“{d.example}”</p>
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
        English &amp; audio from dictionaryapi.dev · Chinese translated to 香港繁體
      </footer>
    </div>
  );
}

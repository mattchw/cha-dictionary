# 英漢詞典 — English → 香港繁體 Dictionary

A small Next.js (App Router, TypeScript) dictionary app. Look up an English word
and get its definition, an example, pronunciation, and a Hong Kong written
Traditional Chinese translation. Built to deploy on Vercel.

- English definitions, examples, and phonetics come from
  [Free Dictionary API](https://freedictionaryapi.com) (Wiktionary data), with
  dictionaryapi.dev as a fallback for audio when available.
- Traditional Chinese glosses come from [CC-CEDICT](https://cc-cedict.org/) — no
  API key required. Optional Claude or DeepL fallback for long definitions.
- Two-phase UX: English paints immediately, the Chinese fills in behind it.

## Run locally

```bash
npm install
npm run download-words   # word list, frequency data, CC-CEDICT (~15 MB total)
npm run dev              # http://localhost:3000
```

Optional: `cp .env.example .env.local` and set `TRANSLATOR_FALLBACK=claude` if you
want AI translation for full definition sentences.

## Environment variables

| Variable               | Required | Notes                                                       |
| ---------------------- | -------- | ----------------------------------------------------------- |
| `TRANSLATOR_FALLBACK`  | no       | `claude` or `deepl` — fills gaps CC-CEDICT cannot cover     |
| `ANTHROPIC_API_KEY`    | if claude fallback | from the Anthropic console                    |
| `ANTHROPIC_MODEL`      | no       | defaults to a Haiku model                                   |
| `DEEPL_API_KEY`        | if deepl fallback  | DeepL API Free; target language is `ZH-HANT`    |

## Deploy to Vercel

1. Push this folder to a GitHub repo (include `data/cedict.txt` or rely on
   `prebuild` to download it).
2. In Vercel, **Add New → Project** and import the repo (it auto-detects Next.js).
3. Optionally add `TRANSLATOR_FALLBACK` env vars under **Settings → Environment Variables**.
4. Deploy. Your app is live at `https://<project>.vercel.app`.

Or from the CLI: `npm i -g vercel && vercel`.

## How it fits together

```
app/page.tsx            UI (client): autocomplete + two-phase lookup
app/api/entry           GET ?word=  -> English entry
app/api/translate       POST {entry} -> English + 香港繁體 merged
app/api/suggest         GET ?q=     -> autocomplete suggestions
lib/dictionary.ts       fetch + shape Wiktionary entries
lib/cedict.ts           CC-CEDICT reverse index + translation
lib/translate.ts        optional AI fallback (Claude / DeepL)
lib/wordlist.ts         prefix search over local word list
lib/cache.ts            in-memory cache
data/cedict.txt         CC-CEDICT (downloaded by npm run download-words)
```

## Note on data & licensing

English data is from Wiktionary (CC BY-SA). Chinese glosses are from CC-CEDICT
(CC BY-SA 4.0). Attribute accordingly if you ship this publicly.

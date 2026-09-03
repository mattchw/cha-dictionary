# 英漢詞典 — English → 香港繁體 Dictionary

A small Next.js (App Router, TypeScript) dictionary app. Look up an English word
and get its definition, an example, pronunciation, and a Hong Kong written
Traditional Chinese translation. Built to deploy on Vercel.

- English definitions, examples, phonetics, and audio come from
  [dictionaryapi.dev](https://dictionaryapi.dev) — fetched **server-side**, so no
  CORS issues and no keys in the browser.
- Traditional Chinese is produced by a pluggable translator (Claude or DeepL),
  targeting 香港繁體.
- Two-phase UX: English paints immediately, the Chinese fills in behind it.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your key
npm run dev                  # http://localhost:3000
```

## Environment variables

| Variable            | Required            | Notes                                                        |
| ------------------- | ------------------- | ------------------------------------------------------------ |
| `TRANSLATOR`        | no (default claude) | `claude` or `deepl`                                          |
| `ANTHROPIC_API_KEY` | if using claude     | from the Anthropic console                                   |
| `ANTHROPIC_MODEL`   | no                  | defaults to a Haiku model; confirm current names in the docs |
| `DEEPL_API_KEY`     | if using deepl      | DeepL API Free works; target language is `ZH-HANT`           |

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project** and import the repo (it auto-detects Next.js).
3. Under **Settings → Environment Variables**, add the variables above.
4. Deploy. Your app is live at `https://<project>.vercel.app`.

Or from the CLI: `npm i -g vercel && vercel` (add env vars with `vercel env add`).

## How it fits together

```
app/page.tsx            UI (client): calls the two API routes, renders both phases
app/api/entry           GET ?word=  -> English entry (fast)
app/api/translate       GET ?word=  -> English + 香港繁體 merged
lib/dictionary.ts       fetch + shape dictionaryapi.dev; collect/apply helpers
lib/translate.ts        Translator interface + Claude and DeepL implementations
lib/cache.ts            in-memory cache (swap for Vercel KV to make it shared)
```

## Upgrade paths

- **Persistent, shared cache.** The bundled cache is in-memory, so it only helps
  within a warm serverless instance. Swap `lib/cache.ts` for
  [Vercel KV](https://vercel.com/docs/storage/vercel-kv) or Upstash Redis using
  the same `cacheGet` / `cacheSet` shape, and repeat lookups become instant for
  every user.
- **Own the data (fastest, offline-capable).** To stop calling APIs entirely,
  build a local dictionary from the freely downloadable
  [Wiktextract / kaikki.org](https://kaikki.org/dictionary/rawdata.html) dumps
  plus [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) for the
  Chinese side. A full bundle is too large for a Vercel function, so host it in a
  serverless-friendly database such as [Turso](https://turso.tech) (hosted
  SQLite/libSQL) or Vercel Postgres, and read from that instead of dictionaryapi.dev.

## Note on data & licensing

dictionaryapi.dev's underlying data is largely derived from Google/Wiktionary
sources; it's great for personal use, but if this becomes a commercial product,
move to clearly licensed sources (Wiktionary is CC BY-SA — attribution +
share-alike — and CC-CEDICT is also CC BY-SA). Attribute accordingly.

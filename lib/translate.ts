// Pluggable translation for strings CC-CEDICT cannot cover.
// Default Chinese source is CC-CEDICT (lib/cedict.ts). Set TRANSLATOR_FALLBACK
// to claude or deepl to translate longer definitions and examples.

export interface Translator {
  translate(strings: string[]): Promise<string[]>;
}

// --- Claude (Anthropic) ----------------------------------------------------
class ClaudeTranslator implements Translator {
  constructor(private apiKey: string, private model: string) {}

  async translate(strings: string[]): Promise<string[]> {
    const prompt =
      "Translate each item in this JSON array into Traditional Chinese as written " +
      "in Hong Kong (香港繁體中文) — natural, concise, faithful to sense. Return ONLY a " +
      "JSON array of strings, same order and length, no markdown, no other text.\n\n" +
      JSON.stringify(strings);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const data = await res.json();
    const text = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) throw new Error("unexpected translation shape");
    return parsed;
  }
}

// --- DeepL -----------------------------------------------------------------
class DeepLTranslator implements Translator {
  constructor(private apiKey: string) {}

  async translate(strings: string[]): Promise<string[]> {
    const params = new URLSearchParams();
    for (const t of strings) params.append("text", t);
    params.append("source_lang", "EN");
    params.append("target_lang", "ZH-HANT");

    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!res.ok) throw new Error(`DeepL error ${res.status}`);
    const data = await res.json();
    return (data.translations || []).map((t: any) => t.text);
  }
}

function getFallbackTranslator(): Translator | null {
  const which = (process.env.TRANSLATOR_FALLBACK || "").toLowerCase();
  if (!which || which === "none") return null;

  if (which === "deepl") {
    const key = process.env.DEEPL_API_KEY;
    return key ? new DeepLTranslator(key) : null;
  }

  if (which === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    return new ClaudeTranslator(key, model);
  }

  return null;
}

// Fill slots in `out` that CC-CEDICT missed, using the optional AI fallback.
export async function fillMissingTranslations(
  out: (string | null)[],
  missingStrings: string[]
): Promise<void> {
  const translator = getFallbackTranslator();
  if (!translator) return;

  try {
    const translated = await translator.translate(missingStrings);
    let j = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== null) continue;
      out[i] = translated[j++] ?? null;
    }
  } catch {
    // Keep CC-CEDICT hits; leave the rest untranslated.
  }
}

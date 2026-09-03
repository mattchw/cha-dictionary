// Pluggable translation. Swap providers via the TRANSLATOR env var without
// touching anything else. Both implementations target Hong Kong written
// Traditional Chinese (香港繁體).

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
    params.append("target_lang", "ZH-HANT"); // Traditional

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

export function getTranslator(): Translator {
  const which = (process.env.TRANSLATOR || "claude").toLowerCase();

  if (which === "deepl") {
    const key = process.env.DEEPL_API_KEY;
    if (!key) throw new Error("DEEPL_API_KEY is not set");
    return new DeepLTranslator(key);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  return new ClaudeTranslator(key, model);
}

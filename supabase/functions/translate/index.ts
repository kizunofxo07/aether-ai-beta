// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const LANG_NAMES: Record<string, string> = {
  pt: "Brazilian Portuguese", es: "Spanish (neutral Latin American)", ru: "Russian",
  ja: "Japanese using natural Kanji and Kana (native script)",
  "ja-romaji": "Japanese transliterated into Hepburn Romaji (Latin letters only, no Kanji or Kana)",
  zh: "Mandarin Chinese (Simplified, Mainland)", hi: "Hindi (Devanagari)", fr: "French (France)",
  ar: "Modern Standard Arabic", fil: "Filipino (Tagalog)", vi: "Vietnamese", ur: "Urdu", en: "English",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, targetLang, batch } = await req.json();
    const lang = targetLang;
    if (!lang) throw new Error("Missing targetLang");

    // Batch mode: translate an array of strings in ONE call (preserves consistency, faster, cheaper)
    if (Array.isArray(batch)) {
      if (lang === "en") return json({ translations: batch });
      const langName = LANG_NAMES[lang] || lang;
      const numbered = batch.map((t: string, i: number) => `${i + 1}. ${t.replace(/\n/g, " ")}`).join("\n");
      const sys = `You are a professional human translator. Translate each numbered line into ${langName}.
Rules:
- Translate naturally and idiomatically — NOT literally. Sound like a native speaker.
- Preserve meaning, tone, register and any emoji/punctuation.
- Keep proper nouns, brand names, code, URLs and tokens like (Name); "..." or *...* or **...** or ((...)) UNCHANGED.
- Output EXACTLY one numbered line per input, same numbering, same count, no commentary, no quotes around the translation.`;
      const r = await callAI(sys, numbered, "google/gemini-2.5-flash");
      const lines = (r || "").split(/\r?\n/).map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim()).filter(Boolean);
      const out = batch.map((src: string, i: number) => lines[i] || src);
      return json({ translations: out });
    }

    if (!text) throw new Error("Missing text");
    if (lang === "en") return json({ translated: text });

    const langName = LANG_NAMES[lang] || lang;
    const sys = `You are a professional human translator. Translate the user's text into ${langName}.
Rules:
- Translate naturally and idiomatically — NOT literally.
- Preserve meaning, tone, register and any emoji.
- Keep proper nouns, brand names, code, URLs and tokens like (Name); "..." or *...* or **...** or ((...)) UNCHANGED.
- Output ONLY the translated text, no quotes, no explanation, no preface.`;
    const translated = (await callAI(sys, text, "google/gemini-2.5-flash"))?.trim() || text;
    return json({ translated });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

async function callAI(system: string, user: string, model: string) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.2,
    }),
  });
  if (!r.ok) return "";
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

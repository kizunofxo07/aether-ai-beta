// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const LANG_NAMES: Record<string, string> = {
  pt: "Brazilian Portuguese", es: "Spanish", ru: "Russian",
  ja: "Japanese (in Kanji/Kana, native script)",
  "ja-romaji": "Japanese written in Romaji (romanized Latin script only)",
  zh: "Mandarin Chinese (Simplified)", hi: "Hindi", fr: "French",
  ar: "Arabic", fil: "Filipino (Tagalog)", vi: "Vietnamese", ur: "Urdu", en: "English",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, targetLang } = await req.json();
    if (!text || !targetLang) throw new Error("Missing text or targetLang");
    if (targetLang === "en") return new Response(JSON.stringify({ translated: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const langName = LANG_NAMES[targetLang] || targetLang;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `You are a translator. Translate the user's text into ${langName}. Preserve formatting, punctuation, code, and special tokens like (Name); "..." or *...* or **...** or ((...)). Output ONLY the translation, no explanation.` },
          { role: "user", content: text },
        ],
      }),
    });
    if (!r.ok) return new Response(JSON.stringify({ translated: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const j = await r.json();
    const translated = j.choices?.[0]?.message?.content?.trim() ?? text;
    return new Response(JSON.stringify({ translated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

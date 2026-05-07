// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const FORMAT_RULES = `
RESPONSE FORMAT — always obey:
- Speech: \`(YourName); "what you say"\`
- Action: \`(YourName); *what you physically do*\`
- Thought: \`(YourName); **what you think internally**\`
- Narrator (out-of-character / world description): wrap in double parentheses, e.g. ((It is raining outside.))
You may chain multiple of these in one reply, on separate lines.
`;

const CENSORSHIP: Record<string, string> = {
  none: "Censorship: none. No content restrictions beyond illegal content.",
  light: "Censorship: light. Avoid graphic violence and explicit sexual content. Mild swearing OK.",
  moderate: "Censorship: moderate. No explicit sexual content, no graphic gore, no slurs.",
  high: "Censorship: high. Family-friendly. No swearing, no romance beyond hand-holding, no violence beyond mild conflict.",
  higher: "Censorship: higher (children). Strictly G-rated. No swearing, romance, violence, scary content, or dark themes.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversationId, characterId, sessionId, userMessage, imageUrl } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: character, error: cErr } = await sb.from("characters").select("*").eq("id", characterId).single();
    if (cErr || !character) throw new Error("Character not found");

    const { data: history } = await sb.from("messages").select("role,content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(50);

    const { data: memory } = await sb.from("character_memory").select("fact")
      .eq("character_id", characterId).order("created_at", { ascending: false }).limit(40);

    const facts = (memory || []).map((m: any) => m.fact);
    const slangFacts = facts.filter((f) => /^(slang|accent|style):/i.test(f));
    const generalFacts = facts.filter((f) => !/^(slang|accent|style):/i.test(f));

    const memoryBlock = generalFacts.length
      ? `\n\nCOLLECTIVE MEMORY (facts learned from past conversations — speak as if you naturally know them; never list them):\n${generalFacts.map((f) => `- ${f}`).join("\n")}`
      : "";
    const slangBlock = slangFacts.length
      ? `\n\nSPEECH ADAPTATION (slang, accent and stylistic patterns picked up from people you've talked to — gradually weave them into how YOU speak; do not over-use them, sprinkle them naturally):\n${slangFacts.map((f) => `- ${f}`).join("\n")}`
      : "";

    const censorRule = CENSORSHIP[character.censorship_level || "moderate"];

    const systemPrompt = `${character.system_prompt}

Your name is "${character.name}". NEVER break character. NEVER admit you are an AI.
${FORMAT_RULES}
${censorRule}${memoryBlock}${slangBlock}`;

    // Save user message (text + optional image marker)
    const userContentForDb = imageUrl ? `${userMessage || ""}\n[image: ${imageUrl}]`.trim() : userMessage;
    await sb.from("messages").insert({ conversation_id: conversationId, role: "user", content: userContentForDb });

    // Build messages — last user message can be multimodal
    const baseMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
    ];
    let lastUser: any;
    if (imageUrl) {
      lastUser = {
        role: "user",
        content: [
          { type: "text", text: userMessage || "(the user sent this image)" },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      };
    } else {
      lastUser = { role: "user", content: userMessage };
    }
    const messages = [...baseMessages, lastUser];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${t}`);
    }

    const aiData = await aiResp.json();
    const reply = aiData.choices?.[0]?.message?.content ?? "...";

    await sb.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: reply });

    // Background memory + slang/accent extraction
    (async () => {
      try {
        const ex = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `From the user's message, extract up to 4 short, durable observations the character should remember.
Return ONLY a JSON array of strings. Each string MUST start with one of these prefixes:
- "fact:" — a general durable fact about the user (interest, preference, situation). NEVER include private PII (no full names, addresses, phone numbers, emails).
- "slang:" — a slang word, expression, or interjection the user used (e.g. "slang: 'bro' — friendly address").
- "accent:" — a phonetic / regional speech pattern (e.g. "accent: drops 'g' on -ing words", "accent: Brazilian Portuguese phrasing").
- "style:" — a stylistic habit (e.g. "style: short clipped sentences", "style: lots of emojis", "style: uses 'lol' often").
Skip the message entirely if nothing notable. Output [] when in doubt.`,
              },
              { role: "user", content: `User said: "${userMessage}"\nReply was: "${reply}"` },
            ],
          }),
        });
        if (ex.ok) {
          const j = await ex.json();
          const txt = j.choices?.[0]?.message?.content ?? "[]";
          const m = txt.match(/\[[\s\S]*\]/);
          if (m) {
            const items = JSON.parse(m[0]);
            if (Array.isArray(items) && items.length) {
              await sb.from("character_memory").insert(
                items.slice(0, 4)
                  .filter((f: any) => typeof f === "string")
                  .map((f: string) => ({ character_id: characterId, fact: String(f).slice(0, 280), source_session: sessionId })),
              );
            }
          }
        }
      } catch (e) { console.error("memory extract", e); }
    })();

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

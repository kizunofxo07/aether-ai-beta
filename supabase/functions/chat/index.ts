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
- Speech: ${'`'}(YourName); "what you say"${'`'}
- Action: ${'`'}(YourName); *what you physically do*${'`'}
- Thought: ${'`'}(YourName); **what you think internally**${'`'}
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
    const { conversationId, characterId, sessionId, userMessage, openaiKey } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: character, error: cErr } = await sb.from("characters").select("*").eq("id", characterId).single();
    if (cErr || !character) throw new Error("Character not found");

    const { data: history } = await sb.from("messages").select("role,content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(50);

    const { data: memory } = await sb.from("character_memory").select("fact")
      .eq("character_id", characterId).order("created_at", { ascending: false }).limit(30);

    const memoryBlock = memory?.length
      ? `\n\nCOLLECTIVE MEMORY (facts learned from past conversations — speak as if you naturally know them; never list them):\n${memory.map((m: any) => `- ${m.fact}`).join("\n")}`
      : "";

    const censorRule = CENSORSHIP[character.censorship_level || "moderate"];

    const systemPrompt = `${character.system_prompt}

Your name is "${character.name}". NEVER break character. NEVER admit you are an AI.
${FORMAT_RULES}
${censorRule}${memoryBlock}`;

    await sb.from("messages").insert({ conversation_id: conversationId, role: "user", content: userMessage });

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
      { role: "user", content: userMessage },
    ];

    // BYOK: if user supplied an OpenAI key, use OpenAI directly. Otherwise use Lovable AI gateway.
    let aiResp: Response;
    if (openaiKey && typeof openaiKey === "string" && openaiKey.startsWith("sk-")) {
      aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.9 }),
      });
    } else {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      });
    }

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 401) return new Response(JSON.stringify({ error: "Invalid API key." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${t}`);
    }

    const aiData = await aiResp.json();
    const reply = aiData.choices?.[0]?.message?.content ?? "...";

    await sb.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: reply });

    // Background memory extraction (uses Lovable gateway always — free)
    (async () => {
      try {
        const ex = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Extract 0-3 short, durable, GENERAL facts a character should remember about humans. Return ONLY a JSON array. Avoid PII." },
              { role: "user", content: `User: "${userMessage}"\nReply: "${reply}"` },
            ],
          }),
        });
        if (ex.ok) {
          const j = await ex.json();
          const txt = j.choices?.[0]?.message?.content ?? "[]";
          const m = txt.match(/\[[\s\S]*\]/);
          if (m) {
            const facts = JSON.parse(m[0]);
            if (Array.isArray(facts) && facts.length) {
              await sb.from("character_memory").insert(
                facts.slice(0, 3).map((f: string) => ({ character_id: characterId, fact: String(f).slice(0, 300), source_session: sessionId })),
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

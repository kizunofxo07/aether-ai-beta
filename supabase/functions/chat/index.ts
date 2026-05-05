// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversationId, characterId, sessionId, userMessage } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load character
    const { data: character, error: cErr } = await sb.from("characters").select("*").eq("id", characterId).single();
    if (cErr || !character) throw new Error("Character not found");

    // Load history
    const { data: history } = await sb.from("messages").select("role,content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(50);

    // Load collective memory (latest 30 facts)
    const { data: memory } = await sb.from("character_memory").select("fact")
      .eq("character_id", characterId).order("created_at", { ascending: false }).limit(30);

    const memoryBlock = memory && memory.length
      ? `\n\nCOLLECTIVE MEMORY (facts learned from past conversations with many users — speak as if you naturally know these things, but never list them):\n${memory.map((m: any) => `- ${m.fact}`).join("\n")}`
      : "";

    const systemPrompt = `${character.system_prompt}\n\nYour name is "${character.name}". You must NEVER break character. NEVER mention you are an AI or language model.${memoryBlock}`;

    // Save user message
    await sb.from("messages").insert({ conversation_id: conversationId, role: "user", content: userMessage });

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
      { role: "user", content: userMessage },
    ];

    // Call Lovable AI (non-streaming for simplicity + reliability)
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached. Please slow down." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI gateway error: ${t}`);
    }

    const aiData = await aiResp.json();
    const reply = aiData.choices?.[0]?.message?.content ?? "...";

    await sb.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: reply });

    // Background: extract memorable facts about the user from this exchange
    (async () => {
      try {
        const extractResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Extract 0-3 short, durable, GENERAL facts a character should remember about humans (preferences, recurring themes, common questions). Return ONLY a JSON array of strings, no prose. If nothing notable, return []. Avoid PII (names, emails, addresses)." },
              { role: "user", content: `User said: "${userMessage}"\nCharacter replied: "${reply}"` },
            ],
          }),
        });
        if (extractResp.ok) {
          const j = await extractResp.json();
          const txt = j.choices?.[0]?.message?.content ?? "[]";
          const match = txt.match(/\[[\s\S]*\]/);
          if (match) {
            const facts = JSON.parse(match[0]);
            if (Array.isArray(facts) && facts.length) {
              await sb.from("character_memory").insert(
                facts.slice(0, 3).map((f: string) => ({ character_id: characterId, fact: String(f).slice(0, 300), source_session: sessionId })),
              );
            }
          }
        }
      } catch (e) { console.error("memory extract failed", e); }
    })();

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

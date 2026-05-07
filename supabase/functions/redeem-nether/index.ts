// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Sign in required" }, 401);
    const { code } = await req.json();
    if (!code || typeof code !== "string") return j({ error: "Code required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return j({ error: "Sign in required" }, 401);
    const userId = u.user.id;

    const sb = createClient(url, service);
    const trimmed = code.trim().toUpperCase();
    const { data: row } = await sb.from("nether_codes").select("*").eq("code", trimmed).maybeSingle();
    if (!row) return j({ error: "Invalid code" }, 400);
    if (row.redeemed_by) return j({ error: "Code already used" }, 400);

    const { error: e1 } = await sb.from("nether_codes").update({ redeemed_by: userId, redeemed_at: new Date().toISOString() }).eq("id", row.id).is("redeemed_by", null);
    if (e1) return j({ error: e1.message }, 500);

    const { error: e2 } = await sb.from("profiles").update({ plan: "nether" }).eq("user_id", userId);
    if (e2) return j({ error: e2.message }, 500);

    return j({ ok: true });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
function j(b, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

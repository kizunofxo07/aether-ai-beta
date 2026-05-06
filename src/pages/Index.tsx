import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { CATEGORIES } from "@/lib/categories";
import { T } from "@/components/T";

type Character = {
  id: string; name: string; description: string; avatar_url: string | null;
  tags: string[]; is_official: boolean; is_owner_official: boolean;
  category: string; visibility: string;
};

const Index = () => {
  const [chars, setChars] = useState<Character[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("characters").select("*").eq("visibility", "public")
      .order("is_owner_official", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => { setChars((data as Character[]) ?? []); setLoading(false); });
  }, []);

  const filtered = chars.filter((c) => {
    if (cat !== "All" && c.category !== cat) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.description.toLowerCase().includes(s) || c.tags.some(t => t.toLowerCase().includes(s));
  });

  return (
    <Layout>
      <div className="container max-w-6xl py-8">
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2"><T>Chat with anyone</T></h1>
          <p className="text-muted-foreground"><T>Pick a character or create your own.</T></p>
        </section>

        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {["All", ...CATEGORIES].map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${cat === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-44 rounded-lg bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12"><T>No characters found.</T></p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <Link key={c.id} to={`/chat/${c.id}`}
                className={`group bg-card rounded-lg p-5 border border-border hover:border-foreground/30 transition-all ${c.is_owner_official ? "gold-outline" : ""}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-12 w-12 rounded-md bg-secondary flex items-center justify-center text-lg font-semibold overflow-hidden flex-shrink-0">
                    {c.avatar_url ? <img src={c.avatar_url} alt={c.name} className="h-full w-full object-cover" /> : c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate flex items-center gap-1.5">{c.name}{c.is_owner_official && <span className="text-gold text-xs">★</span>}</h3>
                    <span className="text-xs text-muted-foreground">{c.category}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                <div className="flex flex-wrap gap-1">
                  {c.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;

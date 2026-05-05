import { Link } from "react-router-dom";
import { Sparkles, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Character = {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  tags: string[];
  is_official: boolean;
};

const Index = () => {
  const [chars, setChars] = useState<Character[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("characters").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setChars((data as Character[]) ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = chars.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.description.toLowerCase().includes(q.toLowerCase()) || c.tags.some(t => t.includes(q.toLowerCase()))
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10 bg-background/60">
        <div className="container flex items-center justify-between py-5">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold gradient-text">Mythos</span>
          </Link>
          <Link to="/create">
            <Button variant="default" className="gradient-bg text-primary-foreground border-0 hover:opacity-90">
              <Plus className="h-4 w-4 mr-1" /> Create Character
            </Button>
          </Link>
        </div>
      </header>

      <main className="container py-12">
        <section className="text-center max-w-3xl mx-auto mb-14">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Chat with <span className="gradient-text">anyone</span>,<br />real or imagined.
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Pick a character from the catalog or craft your own — give it a face, a voice, a soul. Every conversation feeds a collective memory that makes them grow.
          </p>
          <Input
            placeholder="Search characters, tags, vibes..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md mx-auto h-12 text-base bg-card border-border"
          />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">Catalog</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 rounded-2xl card-gradient animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((c) => (
                <Link
                  key={c.id}
                  to={`/chat/${c.id}`}
                  className="group card-gradient rounded-2xl p-6 border border-border/50 shadow-card hover:shadow-glow hover:border-primary/50 transition-all hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-16 w-16 rounded-2xl gradient-bg flex items-center justify-center text-2xl font-bold text-primary-foreground overflow-hidden flex-shrink-0">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.name} className="h-full w-full object-cover" />
                      ) : (
                        c.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg truncate">{c.name}</h3>
                      {c.is_official && <span className="text-xs text-accent">★ Official</span>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{c.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{t}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="container py-10 text-center text-sm text-muted-foreground border-t border-border/50 mt-10">
        Built with Lovable · No API key required
      </footer>
    </div>
  );
};

export default Index;

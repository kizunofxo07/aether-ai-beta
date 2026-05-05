import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  description: z.string().trim().min(1, "Description required").max(500),
  greeting: z.string().trim().min(1, "Greeting required").max(500),
  system_prompt: z.string().trim().min(20, "Prompt must be at least 20 chars").max(4000),
  tags: z.string().max(200),
});

const Create = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", description: "", greeting: "Hi there!", system_prompt: "", tags: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFile = (f: File | null) => {
    setAvatarFile(f);
    setAvatarPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    try {
      let avatar_url: string | null = null;
      if (avatarFile) {
        const path = `${crypto.randomUUID()}-${avatarFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (upErr) throw upErr;
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const tags = form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 6);
      const { data, error } = await supabase.from("characters").insert({
        name: form.name.trim(),
        description: form.description.trim(),
        greeting: form.greeting.trim(),
        system_prompt: form.system_prompt.trim(),
        tags,
        avatar_url,
      }).select("id").single();
      if (error) throw error;
      toast.success("Character created!");
      navigate(`/chat/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10 bg-background/60">
        <div className="container flex items-center gap-3 py-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="font-bold text-lg">Create a Character</h1>
        </div>
      </header>

      <main className="container max-w-2xl py-10 space-y-6">
        <div className="text-center mb-4">
          <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
          <h2 className="text-3xl font-bold gradient-text mb-2">Forge a soul</h2>
          <p className="text-muted-foreground">Define a personality. The system prompt is the heart — it shapes every word they say.</p>
        </div>

        <div className="card-gradient rounded-2xl p-6 border border-border/50 space-y-5 shadow-card">
          <div>
            <Label>Avatar</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="h-20 w-20 rounded-2xl gradient-bg flex items-center justify-center overflow-hidden">
                {avatarPreview ? <img src={avatarPreview} className="h-full w-full object-cover" alt="" /> : <Upload className="h-7 w-7 text-primary-foreground" />}
              </div>
              <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="bg-secondary" />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Captain Vesper" className="bg-secondary mt-1" />
          </div>

          <div>
            <Label htmlFor="desc">Short description</Label>
            <Input id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A weary space pirate with a heart of gold." className="bg-secondary mt-1" />
          </div>

          <div>
            <Label htmlFor="greet">Opening line</Label>
            <Input id="greet" value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} placeholder="Welcome aboard, stranger..." className="bg-secondary mt-1" />
          </div>

          <div>
            <Label htmlFor="prompt">System prompt — the soul</Label>
            <Textarea
              id="prompt"
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              placeholder="You are Captain Vesper, a 38-year-old space pirate from the outer rim. You speak with a gravelly voice, drop nautical metaphors, distrust corporations, but secretly help orphans. Stay in character at all times. Never break the fourth wall."
              rows={8}
              className="bg-secondary mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">This is memorized for the entire conversation. Be specific about tone, backstory, quirks, and rules.</p>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="scifi, roleplay, pirate" className="bg-secondary mt-1" />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full h-12 gradient-bg text-primary-foreground border-0 hover:opacity-90">
            {submitting ? "Forging..." : "Bring to life"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Create;

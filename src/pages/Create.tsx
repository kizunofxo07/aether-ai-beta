import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, TAG_LIBRARY } from "@/lib/categories";
import { CHARACTER_TEMPLATES } from "@/lib/templates";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(500),
  greeting: z.string().trim().min(1).max(500),
  system_prompt: z.string().trim().min(20).max(4000),
});

const CreateOrEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const { user, roles, loading } = useAuth();
  const [form, setForm] = useState({
    name: "", description: "", greeting: "Hi there!", system_prompt: "",
    category: "Other", visibility: "public" as "public" | "unlisted" | "private",
    censorship_level: "moderate" as "none"|"light"|"moderate"|"high"|"higher",
    tags: [] as string[], avatar_url: null as string | null,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [parentalUnlocked, setParentalUnlocked] = useState(false);

  const isStaff = roles.some((r) => ["owner","admin","moderator","staff"].includes(r));

  useEffect(() => {
    if (!editing || !id) return;
    supabase.from("characters").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) { navigate("/"); return; }
      setForm({
        name: data.name, description: data.description, greeting: data.greeting,
        system_prompt: data.system_prompt, category: data.category,
        visibility: data.visibility, censorship_level: data.censorship_level,
        tags: data.tags ?? [], avatar_url: data.avatar_url,
      });
      setAvatarPreview(data.avatar_url);
    });
  }, [id, editing, navigate]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const onFile = (f: File | null) => {
    setAvatarFile(f);
    setAvatarPreview(f ? URL.createObjectURL(f) : form.avatar_url);
  };

  const toggleTag = (t: string) => {
    setForm((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t].slice(0, 6) }));
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setSubmitting(true);
    try {
      let avatar_url = form.avatar_url;
      if (avatarFile) {
        const path = `${user.id}/${crypto.randomUUID()}-${avatarFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (upErr) throw upErr;
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const payload: any = {
        name: form.name.trim(), description: form.description.trim(),
        greeting: form.greeting.trim(), system_prompt: form.system_prompt.trim(),
        tags: form.tags, avatar_url, category: form.category,
        visibility: form.visibility, censorship_level: form.censorship_level,
      };

      if (editing && id) {
        const { error } = await supabase.from("characters").update(payload).eq("id", id);
        if (error) throw error;
        toast.success("Updated");
        navigate(`/chat/${id}`);
      } else {
        payload.owner_id = user.id;
        const { data, error } = await supabase.from("characters").insert(payload).select("id").single();
        if (error) throw error;
        toast.success("Character created!");
        navigate(`/chat/${data.id}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="text-2xl font-semibold mb-6">{editing ? "Edit character" : "Create character"}</h1>

        {!editing && (
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold mb-2">Start from a template</h2>
            <div className="flex flex-wrap gap-2">
              {CHARACTER_TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm((f) => ({
                  ...f,
                  name: t.name || f.name,
                  description: t.description || f.description,
                  greeting: t.greeting,
                  system_prompt: t.system_prompt,
                  category: t.category,
                  tags: t.tags,
                }))}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary">
                  {t.id === "blank" ? "Blank" : t.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Templates fill the fields below — you can tweak everything before saving.</p>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div>
            <Label>Avatar</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="h-20 w-20 rounded-md bg-secondary flex items-center justify-center overflow-hidden">
                {avatarPreview ? <img src={avatarPreview} className="h-full w-full object-cover" alt="" /> : <Upload className="h-6 w-6 opacity-60" />}
              </div>
              <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Captain Vesper" /></div>
          <div><Label>Short description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Opening greeting</Label><Input value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} /></div>

          <div>
            <Label>System prompt — the soul</Label>
            <Textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={8} className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Memorized throughout every chat.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v: any) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — listed in catalog</SelectItem>
                  <SelectItem value="unlisted">Unlisted — only with link</SelectItem>
                  <SelectItem value="private">Private — only you</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Censorship level</Label>
            <Select value={form.censorship_level} onValueChange={(v: any) => setForm({ ...form, censorship_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high" disabled={!parentalUnlocked && !isStaff}>High {(!parentalUnlocked && !isStaff) && "(parental control required)"}</SelectItem>
                <SelectItem value="higher">Higher (children-safe)</SelectItem>
              </SelectContent>
            </Select>
            {!isStaff && (
              <button type="button" onClick={() => {
                const pw = prompt("Enter parental control password (set in Settings):");
                if (!pw) return;
                const stored = localStorage.getItem("aether_parental_pw") || "";
                if (pw === stored) { setParentalUnlocked(true); toast.success("Unlocked High level"); }
                else toast.error("Wrong password");
              }} className="text-xs text-muted-foreground hover:text-foreground mt-1">Unlock High via parental password</button>
            )}
          </div>

          <div>
            <Label>Tags ({form.tags.length}/6)</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TAG_LIBRARY.map((t) => (
                <button key={t} type="button" onClick={() => toggleTag(t)}
                  className={`px-2 py-0.5 rounded text-xs border ${form.tags.includes(t) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Saving..." : editing ? "Save changes" : "Create"}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default CreateOrEdit;

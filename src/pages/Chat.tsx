import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Brain, Pencil, ImagePlus, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSessionId } from "@/lib/session";
import { useAuth } from "@/lib/auth";
import { translate, getLang, getTranslateEnabled, onLangChange } from "@/lib/i18n";
import { CHAT_OPENERS } from "@/lib/templates";
import { toast } from "sonner";

type Character = { id: string; name: string; description: string; avatar_url: string | null; greeting: string; owner_id: string | null; is_owner_official: boolean; visibility: string };
type Msg = { role: "user" | "assistant"; content: string; translated?: string; image_url?: string | null };

const Chat = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!characterId) return;
    (async () => {
      const { data: c } = await supabase.from("characters").select("*").eq("id", characterId).maybeSingle();
      if (!c) { navigate("/"); return; }
      setCharacter(c as Character);

      const { count } = await supabase.from("character_memory").select("*", { count: "exact", head: true }).eq("character_id", characterId);
      setMemoryCount(count ?? 0);

      const sessionId = getSessionId();
      let convQuery = supabase.from("conversations").select("id").eq("character_id", characterId);
      if (user) convQuery = convQuery.eq("user_id", user.id);
      else convQuery = convQuery.eq("session_id", sessionId).is("user_id", null);
      const { data: existing } = await convQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created } = await supabase.from("conversations")
          .insert({ character_id: characterId, session_id: sessionId, title: c.name, user_id: user?.id ?? null })
          .select("id").single();
        convId = created!.id;
      }
      setConversationId(convId!);

      const { data: msgs } = await supabase.from("messages").select("role,content")
        .eq("conversation_id", convId).order("created_at", { ascending: true });
      const list = (msgs as Msg[]) ?? [];
      if (list.length === 0) list.push({ role: "assistant", content: c.greeting });
      setMessages(list);
    })();
  }, [characterId, navigate, user]);

  useEffect(() => {
    const run = async () => {
      if (!getTranslateEnabled() || getLang() === "en") {
        setMessages((m) => m.map((x) => ({ ...x, translated: undefined })));
        return;
      }
      const out = await Promise.all(messages.map(async (m) => ({ ...m, translated: await translate(m.content) })));
      setMessages(out);
    };
    const off = onLangChange(run);
    run();
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const pickImage = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Image too large (max 8MB)"); return; }
    setPendingImage({ file: f, preview: URL.createObjectURL(f) });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const sessionId = user?.id ?? getSessionId();
    const path = `${sessionId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !pendingImage) || sending || !conversationId || !characterId) return;
    setInput("");
    let imageUrl: string | null = null;
    if (pendingImage) {
      imageUrl = await uploadImage(pendingImage.file);
      setPendingImage(null);
    }
    const displayed = text || (imageUrl ? "*sent an image*" : "");
    setMessages((m) => [...m, { role: "user", content: displayed, image_url: imageUrl }, { role: "assistant", content: "..." }]);
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { conversationId, characterId, sessionId: getSessionId(), userMessage: text, imageUrl },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setMessages((m) => m.slice(0, -1));
      } else {
        let translated: string | undefined;
        if (getTranslateEnabled() && getLang() !== "en") translated = await translate(data.reply);
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: data.reply, translated }]);
        setMemoryCount((c) => c + 1);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  if (!character) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  const canEdit = user && character.owner_id === user.id;
  const showOpeners = messages.length <= 1;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border sticky top-0 z-10 bg-background">
        <div className="container max-w-4xl flex items-center gap-3 py-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className={`h-10 w-10 rounded-md bg-secondary flex items-center justify-center font-bold overflow-hidden ${character.is_owner_official ? "gold-outline" : ""}`}>
            {character.avatar_url ? <img src={character.avatar_url} className="h-full w-full object-cover" alt="" /> : character.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate flex items-center gap-1.5">{character.name}{character.is_owner_official && <span className="text-gold text-xs">★</span>}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Brain className="h-3 w-3" /> {memoryCount} {memoryCount === 1 ? "fact" : "facts"} learned
            </p>
          </div>
          {canEdit && (
            <Link to={`/edit/${character.id}`}><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></Link>
          )}
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="container max-w-3xl py-6 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              }`}>
                {m.image_url && <img src={m.image_url} alt="" className="rounded mb-2 max-h-72" />}
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1 whitespace-pre-wrap">
                  <ReactMarkdown>{m.translated ?? m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {showOpeners && (
            <div className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">Try one:</p>
              <div className="flex flex-wrap gap-2">
                {CHAT_OPENERS.map((o) => (
                  <button key={o.label} onClick={() => send(o.text)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary">
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border bg-background sticky bottom-0">
        <div className="container max-w-3xl py-3">
          {pendingImage && (
            <div className="mb-2 inline-flex items-center gap-2 bg-secondary rounded-md p-1.5">
              <img src={pendingImage.preview} alt="" className="h-12 w-12 object-cover rounded" />
              <button onClick={() => setPendingImage(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => fileRef.current?.click()} disabled={sending}>
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${character.name}...`}
              rows={1}
              className="min-h-[44px] max-h-32 resize-none"
              disabled={sending}
            />
            <Button onClick={() => send()} disabled={sending || (!input.trim() && !pendingImage)} size="icon" className="h-11 w-11 shrink-0">
              {sending ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center pb-2 px-3">
          Format: (Name); "speak" · *act* · **think** · ((narrator))
        </p>
      </footer>
    </div>
  );
};

export default Chat;

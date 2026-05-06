import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Brain, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSessionId } from "@/lib/session";
import { useAuth } from "@/lib/auth";
import { getOpenAIKey } from "@/lib/byok";
import { translate, getLang, getTranslateEnabled, onLangChange } from "@/lib/i18n";
import { toast } from "sonner";

type Character = { id: string; name: string; description: string; avatar_url: string | null; greeting: string; owner_id: string | null; is_owner_official: boolean; visibility: string };
type Msg = { role: "user" | "assistant"; content: string; translated?: string };

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // re-translate on lang change
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

  const send = async () => {
    if (!input.trim() || sending || !conversationId || !characterId) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "..." }]);
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { conversationId, characterId, sessionId: getSessionId(), userMessage: text, openaiKey: getOpenAIKey() },
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
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1 whitespace-pre-wrap">
                  <ReactMarkdown>{m.translated ?? m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border bg-background sticky bottom-0">
        <div className="container max-w-3xl py-3 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${character.name}...`}
            rows={1}
            className="min-h-[44px] max-h-32 resize-none"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
            {sending ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center pb-2 px-3">
          Format: (Name); "speak" · *act* · **think** · ((narrator))
        </p>
      </footer>
    </div>
  );
};

export default Chat;

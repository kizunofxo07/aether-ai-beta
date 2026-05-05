import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSessionId } from "@/lib/session";
import { toast } from "sonner";

type Character = { id: string; name: string; description: string; avatar_url: string | null; greeting: string };
type Msg = { role: "user" | "assistant"; content: string };

const Chat = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
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
      const { data: c } = await supabase.from("characters").select("*").eq("id", characterId).single();
      if (!c) { navigate("/"); return; }
      setCharacter(c as Character);

      const { count } = await supabase.from("character_memory").select("*", { count: "exact", head: true }).eq("character_id", characterId);
      setMemoryCount(count ?? 0);

      const sessionId = getSessionId();
      const { data: existing } = await supabase
        .from("conversations").select("id").eq("character_id", characterId).eq("session_id", sessionId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created } = await supabase.from("conversations")
          .insert({ character_id: characterId, session_id: sessionId, title: c.name }).select("id").single();
        convId = created!.id;
      }
      setConversationId(convId!);

      const { data: msgs } = await supabase.from("messages").select("role,content")
        .eq("conversation_id", convId).order("created_at", { ascending: true });
      const list = (msgs as Msg[]) ?? [];
      if (list.length === 0) {
        list.push({ role: "assistant", content: c.greeting });
      }
      setMessages(list);
    })();
  }, [characterId, navigate]);

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
        body: { conversationId, characterId, sessionId: getSessionId(), userMessage: text },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setMessages((m) => m.slice(0, -1));
      } else {
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: data.reply }]);
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10 bg-background/70">
        <div className="container flex items-center gap-3 py-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="h-11 w-11 rounded-xl gradient-bg flex items-center justify-center font-bold text-primary-foreground overflow-hidden">
            {character.avatar_url ? <img src={character.avatar_url} className="h-full w-full object-cover" alt="" /> : character.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{character.name}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Brain className="h-3 w-3" /> Collective memory: {memoryCount} {memoryCount === 1 ? "fact" : "facts"}
            </p>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="container max-w-3xl py-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "gradient-bg text-primary-foreground"
                  : "card-gradient border border-border/50 shadow-card"
              }`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/50 bg-background/70 backdrop-blur-md sticky bottom-0">
        <div className="container max-w-3xl py-4 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${character.name}...`}
            rows={1}
            className="min-h-[48px] max-h-32 resize-none bg-card"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="gradient-bg text-primary-foreground border-0 h-12 w-12 shrink-0">
            {sending ? <Sparkles className="h-5 w-5 animate-pulse" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Chat;

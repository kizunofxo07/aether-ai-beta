import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, ChevronDown, ExternalLink } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { T } from "@/components/T";

const DISCORD_URL = "https://discord.gg/mXVeEJdW";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I create my own character?",
    a: "Sign in, then click 'Create character' in the sidebar. Pick a template to start fast, fill in the personality (system prompt) and a greeting, then save. You can edit any character you own at any time.",
  },
  {
    q: "How does the AI 'learn' from me?",
    a: "Each chat extracts a few small facts (interests, slang, accent, style) into a private collective memory tied to that character. Over time the character speaks more like you and remembers what matters.",
  },
  {
    q: "Can I send images to a character?",
    a: "Yes. In any chat, tap the image icon next to the message box to attach a photo. The AI will see and react to it.",
  },
  {
    q: "What is the Nether plan?",
    a: "Nether unlocks animated (GIF) avatars, custom image backgrounds for your profile, and the gold profile flair. You can activate it in Settings → Plan.",
  },
  {
    q: "Why is my translation slow the first time?",
    a: "The first time you switch to a new language, Æther asks the AI for high-quality translations and caches them in your browser. After that they load instantly.",
  },
  {
    q: "How do I change languages?",
    a: "Go to Settings → Language & translation. Choose one of 13 languages and toggle auto-translate on.",
  },
  {
    q: "How do I report a problem or a character?",
    a: "Join our Discord — the staff team responds there fastest.",
  },
  {
    q: "How do I delete my account or chats?",
    a: "Open a chat and use the menu to delete that conversation. To remove your account entirely, contact us on Discord.",
  },
];

const Support = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Layout>
      <div className="container max-w-3xl py-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> <T>Back</T></Link>
        <div>
          <h1 className="text-2xl font-semibold"><T>Support</T></h1>
          <p className="text-muted-foreground text-sm mt-1"><T>Quick answers below — or join us on Discord for anything else.</T></p>
        </div>

        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="block bg-card border border-border rounded-lg p-5 hover:border-foreground/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-[#5865F2]/15 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-[#7289DA]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold flex items-center gap-1.5"><T>Æther Discord server</T> <ExternalLink className="h-3.5 w-3.5 opacity-60" /></div>
              <div className="text-xs text-muted-foreground">{DISCORD_URL}</div>
            </div>
            <Button variant="outline" size="sm"><T>Join</T></Button>
          </div>
        </a>

        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {FAQ.map((item, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="w-full text-left p-4 hover:bg-secondary/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-sm"><T>{item.q}</T></span>
                <ChevronDown className={`h-4 w-4 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </div>
              {open === i && <p className="text-sm text-muted-foreground mt-2 leading-relaxed"><T>{item.a}</T></p>}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Support;

// Higher-quality on-the-fly translation using AI gateway. Caches in localStorage.
// Batches many UI strings into one call so they are consistent and cheap.
import { supabase } from "@/integrations/supabase/client";

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語 (Kanji)" },
  { code: "ja-romaji", label: "Nihongo (Romaji)" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "fil", label: "Filipino" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ur", label: "اردو" },
];

const CACHE_KEY = "aether_i18n_cache_v2";
type Cache = Record<string, Record<string, string>>;
const loadCache = (): Cache => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; } };
const saveCache = (c: Cache) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {} };

const subscribers = new Set<() => void>();
export const onLangChange = (cb: () => void) => { subscribers.add(cb); return () => subscribers.delete(cb); };

export function getLang(): string { return localStorage.getItem("aether_lang") || "en"; }
export function getTranslateEnabled(): boolean { return localStorage.getItem("aether_translate_enabled") === "1"; }
export function setLang(code: string) { localStorage.setItem("aether_lang", code); subscribers.forEach((c) => c()); }
export function setTranslateEnabled(on: boolean) { localStorage.setItem("aether_translate_enabled", on ? "1" : "0"); subscribers.forEach((c) => c()); }

// ---- Batching queue ----
type Pending = { text: string; resolve: (v: string) => void };
const queues: Record<string, Pending[]> = {};
const timers: Record<string, any> = {};

async function flush(lang: string) {
  const items = queues[lang] || [];
  queues[lang] = [];
  timers[lang] = null;
  if (!items.length) return;

  const cache = loadCache();
  cache[lang] = cache[lang] || {};

  // dedupe
  const uniq = Array.from(new Set(items.map((i) => i.text)));
  const need = uniq.filter((t) => !cache[lang][t]);

  if (need.length) {
    try {
      const { data } = await supabase.functions.invoke("translate", { body: { batch: need, targetLang: lang } });
      const translations: string[] = data?.translations || [];
      need.forEach((src, i) => { cache[lang][src] = translations[i] || src; });
      saveCache(cache);
    } catch {
      need.forEach((src) => { cache[lang][src] = src; });
    }
  }
  items.forEach((p) => p.resolve(cache[lang][p.text] || p.text));
}

export async function translate(text: string, targetLang?: string): Promise<string> {
  const lang = targetLang || getLang();
  if (!text || lang === "en") return text;
  if (!getTranslateEnabled()) return text;

  const cache = loadCache();
  if (cache[lang]?.[text]) return cache[lang][text];

  return new Promise<string>((resolve) => {
    queues[lang] = queues[lang] || [];
    queues[lang].push({ text, resolve });
    if (!timers[lang]) timers[lang] = setTimeout(() => flush(lang), 80);
  });
}

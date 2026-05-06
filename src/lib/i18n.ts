// On-the-fly translation using AI gateway. Caches translations in localStorage.
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

const CACHE_KEY = "aether_i18n_cache_v1";
type Cache = Record<string, Record<string, string>>; // lang -> text -> translation
const loadCache = (): Cache => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; } };
const saveCache = (c: Cache) => localStorage.setItem(CACHE_KEY, JSON.stringify(c));

const subscribers = new Set<() => void>();
export const onLangChange = (cb: () => void) => { subscribers.add(cb); return () => subscribers.delete(cb); };

export function getLang(): string {
  return localStorage.getItem("aether_lang") || "en";
}
export function getTranslateEnabled(): boolean {
  return localStorage.getItem("aether_translate_enabled") === "1";
}
export function setLang(code: string) {
  localStorage.setItem("aether_lang", code);
  subscribers.forEach((c) => c());
}
export function setTranslateEnabled(on: boolean) {
  localStorage.setItem("aether_translate_enabled", on ? "1" : "0");
  subscribers.forEach((c) => c());
}

export async function translate(text: string, targetLang?: string): Promise<string> {
  const lang = targetLang || getLang();
  if (lang === "en" || !text) return text;
  if (!getTranslateEnabled()) return text;

  const cache = loadCache();
  if (cache[lang]?.[text]) return cache[lang][text];

  try {
    const { data, error } = await supabase.functions.invoke("translate", {
      body: { text, targetLang: lang },
    });
    if (error || !data?.translated) return text;
    cache[lang] = cache[lang] || {};
    cache[lang][text] = data.translated;
    saveCache(cache);
    return data.translated;
  } catch {
    return text;
  }
}

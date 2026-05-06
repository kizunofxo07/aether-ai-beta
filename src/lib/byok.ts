// Bring-Your-Own-Key. Stored only in this browser's localStorage; sent per-request.
const KEY = "aether_openai_key";
export const getOpenAIKey = () => localStorage.getItem(KEY) || "";
export const setOpenAIKey = (k: string) => { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); };

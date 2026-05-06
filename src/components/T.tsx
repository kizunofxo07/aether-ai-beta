import { useEffect, useState } from "react";
import { getLang, getTranslateEnabled, onLangChange, translate } from "@/lib/i18n";

// <T>Some english text</T> — translated when enabled & lang!=en. Children must be a plain string.
export const T = ({ children }: { children: string }) => {
  const [out, setOut] = useState(children);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!getTranslateEnabled() || getLang() === "en") { setOut(children); return; }
      const t = await translate(children);
      if (alive) setOut(t);
    };
    run();
    const off = onLangChange(run);
    return () => { alive = false; off(); };
  }, [children]);
  return <>{out}</>;
};

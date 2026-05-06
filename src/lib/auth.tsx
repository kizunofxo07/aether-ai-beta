import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Profile = {
  id: string; user_id: string; username: string; display_name: string;
  description: string; avatar_url: string | null;
  background_color: string; background_image_url: string | null;
  is_public: boolean; plan: "free" | "nether"; language_preference: string;
  translation_enabled: boolean; parental_enabled: boolean;
};

type Ctx = {
  session: Session | null; user: User | null; profile: Profile | null;
  roles: string[]; loading: boolean; refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>({} as Ctx);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as any) ?? null);
    setRoles((r ?? []).map((x: any) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) setTimeout(() => loadProfile(s.user.id), 0);
      else { setProfile(null); setRoles([]); }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{
      session, user: session?.user ?? null, profile, roles, loading,
      refreshProfile: async () => { if (session?.user) await loadProfile(session.user.id); },
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);

import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkles, Plus, Settings, LogIn, LogOut, User as UserIcon, MessageSquare, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { T } from "@/components/T";

type ConvRow = { id: string; title: string | null; character_id: string; characters: { name: string; avatar_url: string | null } };

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, roles, signOut, loading } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { setConvs([]); return; }
    supabase.from("conversations")
      .select("id,title,character_id,characters(name,avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setConvs((data as any) ?? []));
  }, [user]);

  const isOwner = roles.includes("owner");
  const isStaff = roles.some((r) => ["owner","admin","moderator","staff"].includes(r));

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform`}>
        <div className="p-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <span className="text-2xl font-bold">Æ</span>
            <span className="text-lg font-semibold tracking-tight">Æther</span>
          </Link>
        </div>

        <div className="p-3 space-y-1">
          <NavLink to="/" end onClick={() => setOpen(false)} className={({isActive}) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent ${isActive ? "bg-sidebar-accent" : ""}`}>
            <Sparkles className="h-4 w-4" /><T>Catalog</T>
          </NavLink>
          {user && (
            <NavLink to="/create" onClick={() => setOpen(false)} className={({isActive}) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent ${isActive ? "bg-sidebar-accent" : ""}`}>
              <Plus className="h-4 w-4" /><T>Create character</T>
            </NavLink>
          )}
          <NavLink to="/settings" onClick={() => setOpen(false)} className={({isActive}) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent ${isActive ? "bg-sidebar-accent" : ""}`}>
            <Settings className="h-4 w-4" /><T>Settings</T>
          </NavLink>
          {isStaff && (
            <NavLink to="/staff" onClick={() => setOpen(false)} className={({isActive}) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent ${isActive ? "bg-sidebar-accent" : ""}`}>
              <Shield className="h-4 w-4 text-gold" /><T>Staff</T>
            </NavLink>
          )}
        </div>

        {user && (
          <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground"><T>Your chats</T></div>
        )}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 pb-2">
            {convs.map((c) => (
              <Link key={c.id} to={`/chat/${c.character_id}`} onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-sidebar-accent truncate">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{c.title || c.characters?.name || "Chat"}</span>
              </Link>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border">
          {loading ? null : user ? (
            <div className="space-y-2">
              <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent">
                <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-xs font-semibold">
                  {profile?.avatar_url ? <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" /> : (profile?.username?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{profile?.display_name || profile?.username}</div>
                  <div className="text-xs text-muted-foreground truncate">@{profile?.username}{profile?.plan === "nether" && <span className="ml-1 text-nether">· Nether</span>}{isOwner && <span className="ml-1 text-gold">· Owner</span>}</div>
                </div>
              </Link>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut().then(()=>navigate("/"))}>
                <LogOut className="h-4 w-4 mr-2" /><T>Sign out</T>
              </Button>
            </div>
          ) : (
            <Button asChild className="w-full"><Link to="/auth"><LogIn className="h-4 w-4 mr-2" /><T>Sign in</T></Link></Button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-12 bg-background border-b border-border flex items-center px-3 gap-2">
        <Button variant="ghost" size="icon" onClick={() => setOpen((v)=>!v)} className="h-8 w-8">☰</Button>
        <span className="font-semibold">Æther</span>
      </div>
      {open && <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setOpen(false)} />}

      <main className="flex-1 min-w-0 pt-12 md:pt-0">{children}</main>
    </div>
  );
};

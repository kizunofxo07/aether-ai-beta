import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

type C = { id: string; name: string; avatar_url: string|null; visibility: string; category: string; is_owner_official: boolean };

const Profile = () => {
  const { user, profile, roles } = useAuth();
  const [chars, setChars] = useState<C[]>([]);

  useEffect(() => {
    if (!user) return;
    (supabase.from("public_characters" as any) as any).select("id,name,avatar_url,visibility,category,is_owner_official")
      .eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setChars((data as C[]) ?? []));
  }, [user]);

  if (!profile) return <Layout><div className="container py-12 text-center text-muted-foreground">Sign in to view profile.</div></Layout>;

  const bgStyle: React.CSSProperties = profile.background_image_url
    ? { backgroundImage: `url(${profile.background_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: profile.background_color };

  const isOwner = roles.includes("owner");

  return (
    <Layout>
      <div className="relative">
        <div className="h-48 w-full" style={bgStyle} />
        <div className="container max-w-3xl -mt-12 relative">
          <Link to="/" className="absolute top-2 left-4 text-white drop-shadow"><ArrowLeft className="h-5 w-5" /></Link>
          <div className={`h-24 w-24 rounded-full bg-secondary border-4 border-background overflow-hidden ${profile.plan === "nether" ? "nether-outline" : ""}`}>
            {profile.avatar_url ? <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" /> : <div className="h-full w-full flex items-center justify-center text-2xl font-bold">{profile.username[0]?.toUpperCase()}</div>}
          </div>
          <div className="mt-3">
            <h1 className="text-2xl font-semibold">{profile.display_name || profile.username}</h1>
            <p className="text-muted-foreground text-sm">@{profile.username}
              {profile.plan === "nether" && <span className="ml-2 text-nether">· Nether</span>}
              {isOwner && <span className="ml-2 text-gold">· Owner</span>}
            </p>
            {profile.description && <p className="mt-3 text-sm">{profile.description}</p>}
          </div>

          <h2 className="mt-8 font-semibold">My characters ({chars.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pb-12">
            {chars.map((c) => (
              <Link key={c.id} to={`/chat/${c.id}`} className={`bg-card border border-border rounded-lg p-3 hover:border-foreground/30 ${c.is_owner_official ? "gold-outline" : ""}`}>
                <div className="h-14 w-14 rounded bg-secondary overflow-hidden mb-2">
                  {c.avatar_url && <img src={c.avatar_url} className="h-full w-full object-cover" alt="" />}
                </div>
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">{c.visibility} · {c.category}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES, getLang, getTranslateEnabled, setLang, setTranslateEnabled } from "@/lib/i18n";

import { toast } from "sonner";

const Settings = () => {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();

  const [lang, setLangState] = useState(getLang());
  const [translateOn, setTranslateOn] = useState(getTranslateEnabled());
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  // profile fields
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [bgColor, setBgColor] = useState("#0a0a0a");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);

  // parental
  const [parentalEnabled, setParentalEnabled] = useState(false);
  const [parentalPw, setParentalPw] = useState("");
  const [parentalPhone, setParentalPhone] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name);
      setDescription(profile.description);
      setBgColor(profile.background_color);
      setBgImage(profile.background_image_url);
      setIsPublic(profile.is_public);
      setParentalEnabled(profile.parental_enabled);
    }
  }, [profile]);

  const isNether = profile?.plan === "nether";

  const saveProfile = async () => {
    if (!user) return;
    try {
      let avatar_url = profile?.avatar_url ?? null;
      let bgImageUrl = bgImage;

      if (avatarFile) {
        const path = `${user.id}/${crypto.randomUUID()}-${avatarFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (error) throw error;
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      if (bgFile && isNether) {
        const path = `${user.id}/${crypto.randomUUID()}-${bgFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("backgrounds").upload(path, bgFile);
        if (error) throw error;
        bgImageUrl = supabase.storage.from("backgrounds").getPublicUrl(path).data.publicUrl;
      }

      const payload: any = {
        username: username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || profile?.username,
        display_name: displayName, description, background_color: bgColor,
        background_image_url: isNether ? bgImageUrl : null,
        is_public: isPublic, language_preference: lang, translation_enabled: translateOn,
        parental_enabled: parentalEnabled, parental_phone: parentalPhone, avatar_url,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("user_id", user.id);
      if (error) throw error;

      if (parentalEnabled && parentalPw) localStorage.setItem("aether_parental_pw", parentalPw);
      else if (!parentalEnabled) localStorage.removeItem("aether_parental_pw");

      await refreshProfile();
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const applyLang = (v: string) => { setLangState(v); setLang(v); };
  const applyTranslate = (v: boolean) => { setTranslateOn(v); setTranslateEnabled(v); };
  const redeem = async () => {
    if (!promoCode.trim() || !user) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-nether", { body: { code: promoCode.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Nether unlocked! ✨");
      setPromoCode("");
      await refreshProfile();
    } catch (e: any) {
      toast.error(e?.message ?? "Invalid code");
    } finally { setRedeeming(false); }
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Translation */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Language & translation</h2>
          <div className="flex items-center justify-between">
            <div><Label>Auto-translate UI & chats</Label><p className="text-xs text-muted-foreground">Uses AI; first translation per phrase calls the gateway.</p></div>
            <Switch checked={translateOn} onCheckedChange={applyTranslate} />
          </div>
          <div>
            <Label>Language</Label>
            <Select value={lang} onValueChange={applyLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>


        {/* Profile */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <div><Label>@username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div><Label>Avatar {isNether && "(GIF allowed for Nether)"}</Label><Input type="file" accept={isNether ? "image/*,image/gif" : "image/png,image/jpeg,image/webp"} onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /></div>
          <div><Label>Background color</Label><Input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-24 p-1" /></div>
          {isNether ? (
            <div><Label className="text-nether">Background image (Nether)</Label><Input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files?.[0] ?? null)} /></div>
          ) : (
            <p className="text-xs text-muted-foreground">Upgrade to <span className="text-nether font-semibold">Nether</span> for animated avatars and image backgrounds.</p>
          )}
          <div className="flex items-center justify-between"><Label>Public profile</Label><Switch checked={isPublic} onCheckedChange={setIsPublic} /></div>
        </div>

        {/* Parental */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Parental control</h2>
          <p className="text-xs text-muted-foreground">When enabled, "High" censorship can be unlocked with the password. Phone verification arrives once SMS is wired.</p>
          <div className="flex items-center justify-between"><Label>Enable</Label><Switch checked={parentalEnabled} onCheckedChange={setParentalEnabled} /></div>
          {parentalEnabled && (
            <>
              <div><Label>Password</Label><Input type="password" value={parentalPw} onChange={(e) => setParentalPw(e.target.value)} placeholder="Set or change password" /></div>
              <div><Label>Phone (for verification)</Label><Input value={parentalPhone} onChange={(e) => setParentalPhone(e.target.value)} placeholder="+1 555 ..." /></div>
            </>
          )}
        </div>

        {/* Plan */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Plan</h2>
          <p className="text-sm">Current: <span className={profile?.plan === "nether" ? "text-nether font-semibold" : ""}>{profile?.plan === "nether" ? "Nether" : "Free"}</span></p>
          {profile?.plan !== "nether" && (
            <Button variant="outline" disabled>Upgrade to Nether — payment coming soon</Button>
          )}
        </div>

        <Button onClick={saveProfile} className="w-full">Save profile</Button>

        <div className="text-center text-xs text-muted-foreground pt-4">
          Contact: torajoazul3@gmail.com · <a className="underline hover:text-foreground" href="https://discord.gg/" target="_blank" rel="noreferrer">Discord</a>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Account created. Check your email to confirm."); navigate("/"); }
  };

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate("/");
  };

  const oauth = async (provider: "google" | "apple") => {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-8">
        <Link to="/" className="block text-center mb-6">
          <div className="text-3xl font-bold">Æ</div>
          <div className="text-sm text-muted-foreground">Æther</div>
        </Link>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
            <Button className="w-full" onClick={signIn} disabled={busy}>Sign in</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
            <div><Label>Password (min 6)</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
            <Button className="w-full" onClick={signUp} disabled={busy}>Create account</Button>
          </TabsContent>
        </Tabs>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => oauth("google")}>Continue with Google</Button>
          <Button variant="outline" className="w-full" onClick={() => oauth("apple")}>Continue with Apple</Button>
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 text-center">
          Outlook / Hotmail / Proton / Facebook users: please use the email/password form. Any email address works.
        </p>
      </div>
    </div>
  );
};

export default Auth;

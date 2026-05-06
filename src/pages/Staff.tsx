import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STAFF_EMAILS = [
  "torajoazul3@gmail.com","kizunofxo07@gmail.com","kizunofxo07@proton.me",
  "kizunofxo08@gmail.com","kizunofxo09@gmail.com",
  "davisamuellima789@gmail.com","isaquedaniellima789@gmail.com",
];

const Staff = () => {
  const { roles } = useAuth();
  const isOwner = roles.includes("owner");
  const isStaff = roles.some((r) => ["owner","admin","moderator","staff"].includes(r));

  const [html, setHtml] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    supabase.from("staff_content").select("html").eq("slug","staff-page").maybeSingle()
      .then(({ data }) => setHtml(data?.html ?? ""));
  }, []);

  const save = async () => {
    const { error } = await supabase.from("staff_content").update({ html, updated_at: new Date().toISOString() }).eq("slug","staff-page");
    if (error) toast.error(error.message); else { toast.success("Saved"); setEditing(false); }
  };

  if (!isStaff) return <Layout><div className="container py-12 text-center text-muted-foreground">Staff only.</div></Layout>;

  return (
    <Layout>
      <div className="container max-w-3xl py-8 space-y-6">
        <h1 className="text-2xl font-semibold">Staff</h1>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Editable HTML block</h2>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</Button>
            )}
          </div>
          {editing && isOwner ? (
            <div className="space-y-2">
              <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12} className="font-mono text-xs" />
              <Button size="sm" onClick={save}>Save</Button>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {!isOwner && <p className="text-xs text-muted-foreground mt-3">Only owners can edit this block.</p>}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-2">Contact</h2>
          <ul className="text-sm space-y-1">
            {STAFF_EMAILS.map((e) => <li key={e}><a className="hover:text-foreground text-muted-foreground" href={`mailto:${e}`}>{e}</a></li>)}
          </ul>
          <p className="mt-3 text-sm">
            <a className="underline" href="https://discord.gg/" target="_blank" rel="noreferrer">Join the Discord</a>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Staff;

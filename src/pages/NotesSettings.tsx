import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";

const AUDIENCES = [
  { id: "contacts", label: "Contacts" },
  { id: "close", label: "Close friends" },
  { id: "everyone", label: "Everyone" },
];

export default function NotesSettings() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [enabled, setEnabled] = useState(true);
  const [audience, setAudience] = useState("contacts");
  const [myNote, setMyNote] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);

  useEffect(() => {
    setEnabled(localStorage.getItem("hellow_notes_enabled") !== "0");
    setAudience(localStorage.getItem("hellow_notes_audience") || "contacts");
  }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).gt("expires_at", new Date().toISOString()).maybeSingle();
    setMyNote(data);
    if (data) {
      const { data: r } = await supabase.from("note_reactions").select("*").eq("note_id", data.id).order("created_at", { ascending: false });
      const ids = Array.from(new Set((r || []).map((x: any) => x.user_id)));
      let pmap: Record<string, any> = {};
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
        (p || []).forEach((x: any) => (pmap[x.id] = x));
      }
      setReplies((r || []).map((x: any) => ({ ...x, profile: pmap[x.user_id] })));
    } else setReplies([]);
  };

  useEffect(() => { load(); }, [user?.id]);

  const toggle = (v: boolean) => {
    setEnabled(v);
    localStorage.setItem("hellow_notes_enabled", v ? "1" : "0");
    toast.success(v ? "Notes shown on Chats" : "Notes hidden");
  };

  const chooseAudience = (a: string) => {
    setAudience(a);
    localStorage.setItem("hellow_notes_audience", a);
    toast.success("Default audience saved");
  };

  const deleteMine = async () => {
    if (!myNote) return;
    await supabase.from("notes").delete().eq("id", myNote.id);
    toast.success("Note removed"); load();
  };

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-bold">Notes</h1>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="font-semibold">Show notes on Chats</p>
            <p className="text-xs text-muted-foreground">Hide the notes row at the top</p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <p className="font-semibold mb-2">Default audience</p>
        <p className="text-xs text-muted-foreground mb-3">Who sees notes you share by default</p>
        <div className="flex gap-2 flex-wrap">
          {AUDIENCES.map((a) => (
            <button key={a.id} onClick={() => chooseAudience(a.id)}
              className={`px-3 h-9 rounded-full text-xs font-medium ${audience === a.id ? "bg-foreground text-background" : "bg-muted"}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <p className="font-semibold mb-2">Your active note</p>
        {myNote ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted/50 rounded-2xl px-3 py-2 text-sm">
              <span className="mr-1">{myNote.emoji}</span>{myNote.body}
              <p className="text-[10px] text-muted-foreground mt-0.5">Expires {formatDistanceToNow(new Date(myNote.expires_at), { addSuffix: true })}</p>
            </div>
            <Button size="sm" variant="outline" onClick={deleteMine} className="rounded-full"><Trash2 className="w-3.5 h-3.5 mr-1" /> Remove</Button>
          </div>
        ) : <p className="text-xs text-muted-foreground">You don't have a note right now. Tap "+ Note" on Chats.</p>}
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" />
          <p className="font-semibold">Replies to your note</p>
        </div>
        {replies.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No replies yet</p>}
        <div className="space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-3 py-2 border-t">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.profile?.name || "Someone"}</p>
                <p className="text-sm text-muted-foreground">{r.body || r.emoji}</p>
              </div>
              <p className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

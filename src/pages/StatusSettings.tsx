import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";

const PRIVACY = [
  { id: "everyone", label: "Everyone" },
  { id: "contacts", label: "My contacts" },
  { id: "close", label: "Close friends" },
];

export default function StatusSettings() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [defaultPrivacy, setDefaultPrivacy] = useState("contacts");
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [muteFromMe, setMuteFromMe] = useState(false);
  const [stories, setStories] = useState<any[]>([]);

  useEffect(() => {
    setDefaultPrivacy(localStorage.getItem("hellow_status_privacy") || "contacts");
    setAllowReplies(localStorage.getItem("hellow_status_replies") !== "0");
    setAllowReactions(localStorage.getItem("hellow_status_reactions") !== "0");
    setMuteFromMe(localStorage.getItem("hellow_status_mute_self") === "1");
  }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("statuses").select("*").eq("user_id", user.id).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
    setStories(data || []);
  };

  useEffect(() => { load(); }, [user?.id]);

  const save = (key: string, val: string) => {
    localStorage.setItem(key, val);
    toast.success("Saved");
  };

  const deleteOne = async (id: string) => {
    await supabase.from("statuses").delete().eq("id", id);
    toast.success("Story deleted"); load();
  };

  const deleteAll = async () => {
    if (!user || !stories.length) return;
    await supabase.from("statuses").delete().eq("user_id", user.id);
    toast.success("All stories deleted"); load();
  };

  const Row = ({ label, sub, checked, onChange }: any) => (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-bold">Status</h1>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4" /><p className="font-semibold">Default privacy</p></div>
        <p className="text-xs text-muted-foreground mb-3">Who can see new stories you post</p>
        <div className="flex gap-2 flex-wrap">
          {PRIVACY.map((p) => (
            <button key={p.id} onClick={() => { setDefaultPrivacy(p.id); save("hellow_status_privacy", p.id); }}
              className={`px-3 h-9 rounded-full text-xs font-medium ${defaultPrivacy === p.id ? "bg-foreground text-background" : "bg-muted"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4 divide-y divide-border/40">
        <Row label="Allow replies" sub="Let viewers reply to your stories" checked={allowReplies}
          onChange={(v: boolean) => { setAllowReplies(v); localStorage.setItem("hellow_status_replies", v ? "1" : "0"); }} />
        <Row label="Allow reactions" sub="Let viewers react with emojis" checked={allowReactions}
          onChange={(v: boolean) => { setAllowReactions(v); localStorage.setItem("hellow_status_reactions", v ? "1" : "0"); }} />
        <Row label="Mute my own previews" sub="Don't show my story on top of Chats" checked={muteFromMe}
          onChange={(v: boolean) => { setMuteFromMe(v); localStorage.setItem("hellow_status_mute_self", v ? "1" : "0"); }} />
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Eye className="w-4 h-4" /><p className="font-semibold">My active stories</p></div>
          {stories.length > 0 && <Button size="sm" variant="ghost" onClick={deleteAll} className="text-destructive rounded-full">Clear all</Button>}
        </div>
        {stories.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No active stories</p>}
        <div className="space-y-2">
          {stories.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2 border-t">
              <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center text-xs">
                {s.media_url ? <img src={s.media_url} className="w-full h-full object-cover" /> : (s.story_type || "text")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize truncate">{s.story_type || "story"} · {s.privacy}</p>

                <p className="text-[11px] text-muted-foreground">Expires {formatDistanceToNow(new Date(s.expires_at), { addSuffix: true })}</p>
              </div>
              <button onClick={() => deleteOne(s.id)} className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, X, Eye } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Status() {
  const { user, profile } = useAuth();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [bg, setBg] = useState("var(--gradient-cta)");
  const [viewing, setViewing] = useState<any>(null);
  const [viewers, setViewers] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("statuses")
      .select("id, content, media_url, background, created_at, user_id, profiles:profiles!statuses_user_id_fkey(id, name, avatar_url, username)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setStatuses(data || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("statuses").on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const post = async () => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("statuses").insert({ user_id: user.id, content: text.trim(), background: bg });
    if (error) return toast.error(error.message);
    setText(""); setOpen(false); toast.success("Status posted");
  };

  const myStatuses = statuses.filter((s) => s.user_id === user?.id);
  const others = statuses.filter((s) => s.user_id !== user?.id);

  const view = async (s: any) => {
    setViewing(s);
    setViewers([]);
    if (user && s.user_id !== user.id) {
      await supabase.from("status_views").insert({ status_id: s.id, viewer_id: user.id }).then(() => {});
    } else if (user && s.user_id === user.id) {
      const { data } = await supabase.rpc("get_status_views", { _status_id: s.id });
      setViewers(data || []);
    }
  };

  const gradients = ["var(--gradient-cta)", "var(--gradient-bubble)", "var(--gradient-card)", "linear-gradient(135deg,#a8edea,#fed6e3)", "linear-gradient(135deg,#667eea,#764ba2)"];

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Status</h1>
        <button onClick={() => setOpen(true)} className="w-11 h-11 rounded-full flex items-center justify-center shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* My status */}
      <button onClick={() => myStatuses[0] ? view(myStatuses[0]) : setOpen(true)} className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] mb-6">
        <div className="relative">
          <Avatar className="w-14 h-14">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center bg-white shadow">
            <Plus className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold">My status</p>
          <p className="text-xs text-muted-foreground">{myStatuses.length ? `${myStatuses.length} update(s)` : "Tap to add status"}</p>
        </div>
      </button>

      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-2">Recent updates</p>
      <div className="space-y-2">
        {others.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No recent updates</p>}
        {others.map((s) => (
          <button key={s.id} onClick={() => view(s)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/60">
            <div className="rounded-full p-[2px]" style={{ background: "var(--gradient-cta)" }}>
              <Avatar className="w-12 h-12 ring-2 ring-background">
                <AvatarImage src={s.profiles?.avatar_url || undefined} />
                <AvatarFallback>{s.profiles?.name?.[0]}</AvatarFallback>
              </Avatar>
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold">{s.profiles?.name}</p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border-0">
          <DialogHeader><DialogTitle>New status</DialogTitle></DialogHeader>
          <div className="rounded-2xl p-6 min-h-[160px] flex items-center justify-center" style={{ background: bg }}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind?" className="bg-transparent border-0 text-center text-lg font-semibold resize-none focus-visible:ring-0" />
          </div>
          <div className="flex gap-2 justify-center">
            {gradients.map((g) => (
              <button key={g} onClick={() => setBg(g)} className={`w-8 h-8 rounded-full ${bg === g ? "ring-2 ring-foreground" : ""}`} style={{ background: g }} />
            ))}
          </div>
          <Button onClick={post} className="rounded-full h-12 text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>Post</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="rounded-3xl border-0 p-0 overflow-hidden">
          <div className="rounded-3xl p-8 min-h-[400px] flex flex-col items-center justify-center text-center" style={{ background: viewing?.background || "var(--gradient-cta)" }}>
            <Avatar className="w-16 h-16 mb-3 ring-2 ring-white">
              <AvatarImage src={viewing?.profiles?.avatar_url || undefined} />
              <AvatarFallback>{viewing?.profiles?.name?.[0]}</AvatarFallback>
            </Avatar>
            <p className="font-semibold mb-1">{viewing?.profiles?.name}</p>
            <p className="text-xs text-foreground/70 mb-6">{viewing && formatDistanceToNow(new Date(viewing.created_at), { addSuffix: true })}</p>
            <p className="text-2xl font-semibold leading-snug">{viewing?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

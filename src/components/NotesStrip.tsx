import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const AUDIENCES = [
  { id: "contacts", label: "Contacts" },
  { id: "close", label: "Close friends" },
  { id: "everyone", label: "Everyone" },
];

export default function NotesStrip() {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState<any | null>(null);
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState("💭");
  const [audience, setAudience] = useState("contacts");
  const [reply, setReply] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(40);
    const list = data || [];
    const ids = Array.from(new Set(list.map((n: any) => n.user_id)));
    let map: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
      (profs || []).forEach((p: any) => { map[p.id] = p; });
    }
    setNotes(list.map((n: any) => ({ ...n, profile: map[n.user_id] })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notes-rt").on("postgres_changes", { event: "*", schema: "public", table: "notes" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const myNote = notes.find((n) => n.user_id === user?.id);
  const otherNotes = notes.filter((n) => n.user_id !== user?.id);

  const post = async () => {
    if (!user || !body.trim()) return;
    await supabase.from("notes").delete().eq("user_id", user.id); // one active note per user
    const { error } = await supabase.from("notes").insert({
      user_id: user.id, body: body.trim(), emoji, audience,
    });
    if (error) return toast.error(error.message);
    setBody(""); setOpen(false); toast.success("Note shared");
  };

  const deleteMine = async () => {
    if (!myNote) return;
    await supabase.from("notes").delete().eq("id", myNote.id);
    toast.success("Note removed");
  };

  const sendReply = async () => {
    if (!replyOpen || !user || !reply.trim()) return;
    await supabase.from("note_reactions").insert({ note_id: replyOpen.id, user_id: user.id, emoji: "💬", body: reply.trim() });
    setReply(""); setReplyOpen(null); toast.success("Reply sent");
  };

  return (
    <div className="px-5 pt-5 mb-3">
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-3">
        {/* My note bubble */}
        <button onClick={() => myNote ? deleteMine() : setOpen(true)} className="flex flex-col items-center gap-1 shrink-0 relative">
          <div className="relative">
            <Avatar className="w-12 h-12">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -top-3 -right-1 bg-white border border-border/60 rounded-2xl rounded-bl-md px-2 py-0.5 text-[11px] max-w-[110px] truncate shadow">
              {myNote ? `${myNote.emoji || ""} ${myNote.body}` : "+ Note"}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">Your note</span>
        </button>
        {otherNotes.map((n) => (
          <button key={n.id} onClick={() => setReplyOpen(n)} className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative">
              <Avatar className="w-12 h-12">
                <AvatarImage src={n.profile?.avatar_url || undefined} />
                <AvatarFallback>{n.profile?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="absolute -top-3 -right-1 bg-white border border-border/60 rounded-2xl rounded-bl-md px-2 py-0.5 text-[11px] max-w-[110px] truncate shadow">
                {n.emoji} {n.body}
              </div>
            </div>
            <span className="text-[10px] truncate max-w-[60px]">{n.profile?.name?.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* Composer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Leave a note</DialogTitle></DialogHeader>
          <div className="flex justify-center my-2">
            <div className="bg-white border rounded-2xl rounded-bl-md px-3 py-2 text-sm shadow max-w-[220px] break-words">
              <span className="mr-1">{emoji}</span>{body || "Type a note…"}
            </div>
          </div>
          <div className="flex gap-1.5 justify-center mb-2">
            {["💭","🎵","🔥","❤️","😎","✨","☕","🌙"].map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={`w-9 h-9 rounded-full text-lg ${emoji === e ? "bg-foreground/10" : ""}`}>{e}</button>
            ))}
          </div>
          <Input value={body} onChange={(e) => setBody(e.target.value.slice(0, 60))} placeholder="Share a thought (60 chars)" className="rounded-full h-11" maxLength={60} />
          <div className="flex gap-2 justify-center">
            {AUDIENCES.map((a) => (
              <button key={a.id} onClick={() => setAudience(a.id)} className={`px-3 h-8 rounded-full text-xs font-medium ${audience === a.id ? "bg-foreground text-background" : "bg-muted"}`}>{a.label}</button>
            ))}
          </div>
          <p className="text-[11px] text-center text-muted-foreground">Auto-deletes in 24 hours</p>
          <Button onClick={post} disabled={!body.trim()} className="w-full rounded-full h-11 text-white" style={{ background: "var(--gradient-cta)" }}>Share note</Button>
        </DialogContent>
      </Dialog>

      {/* Reply */}
      <Dialog open={!!replyOpen} onOpenChange={(v) => !v && setReplyOpen(null)}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Reply to {replyOpen?.profile?.name}</DialogTitle></DialogHeader>
          <div className="bg-muted/40 rounded-2xl p-3 text-sm">{replyOpen?.emoji} {replyOpen?.body}</div>
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Send a reply…" className="rounded-full h-11" />
          <Button onClick={sendReply} disabled={!reply.trim()} className="w-full rounded-full h-11 text-white" style={{ background: "var(--gradient-cta)" }}>
            <MessageCircle className="w-4 h-4 mr-1" /> Send
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

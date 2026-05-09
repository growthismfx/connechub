import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, Bell, BellOff, Lock, Star, Trash2, Ban, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  other: any;
  conversationId?: string;
  onCall?: (type: "voice" | "video") => void;
};

export default function ProfileSheet({ open, onOpenChange, other, conversationId, onCall }: Props) {
  const { user } = useAuth();
  const [muted, setMuted] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    if (!open || !user || !conversationId) return;
    (async () => {
      const { data } = await supabase
        .from("conversation_participants")
        .select("is_muted, is_pinned, is_archived")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) { setMuted(!!data.is_muted); setPinned(!!data.is_pinned); setArchived(!!data.is_archived); }
      if (other?.id) {
        const { data: b } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", other.id).maybeSingle();
        setBlocked(!!b);
      }
    })();
  }, [open, user, conversationId, other?.id]);

  const updatePart = async (patch: any) => {
    if (!user || !conversationId) return;
    await supabase.from("conversation_participants").update(patch).eq("conversation_id", conversationId).eq("user_id", user.id);
  };

  const toggleBlock = async () => {
    if (!user || !other?.id) return;
    if (blocked) {
      await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", other.id);
      setBlocked(false); toast.success("Unblocked");
    } else {
      await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: other.id });
      setBlocked(true); toast.success("Blocked");
    }
  };

  const clearChat = async () => {
    if (!conversationId) return;
    if (!confirm("Clear all messages in this chat?")) return;
    // soft clear: only clear local; messages table has no delete RLS. Reset last message instead.
    await supabase.from("conversations").update({ last_message: null }).eq("id", conversationId);
    toast.success("Chat cleared from list");
  };

  const Row = ({ icon: Icon, label, sub, onClick, danger, action }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${danger ? "text-destructive" : ""}`}>
      <Icon className="w-5 h-5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      {action}
    </button>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="p-0 w-full sm:max-w-md overflow-y-auto">
          <div className="relative bg-gradient-to-b from-[hsl(var(--bubble-them))] to-background pt-12 pb-6 px-6 text-center">
            <button onClick={() => setPhotoOpen(true)}>
              <Avatar className="w-32 h-32 mx-auto mb-4 ring-4 ring-background shadow-[var(--shadow-bubble)]">
                <AvatarImage src={other?.avatar_url || undefined} />
                <AvatarFallback className="text-3xl">{other?.name?.[0]}</AvatarFallback>
              </Avatar>
            </button>
            <h2 className="text-2xl font-bold">{other?.name}</h2>
            {other?.username && <p className="text-sm text-muted-foreground">@{other.username}</p>}
            {other?.assigned_number && <p className="text-sm text-muted-foreground mt-1">{other.country_code}{other.assigned_number}</p>}
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={() => onCall?.("voice")} className="w-12 h-12 rounded-full flex items-center justify-center shadow-[var(--shadow-pill)] bg-white">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={() => onCall?.("video")} className="w-12 h-12 rounded-full flex items-center justify-center shadow-[var(--shadow-pill)] bg-white">
                <Video className="w-5 h-5" />
              </button>
            </div>
          </div>

          {other?.status && (
            <div className="px-6 py-3 border-b">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">About</p>
              <p className="text-sm">{other.status}</p>
            </div>
          )}

          <div className="divide-y">
            <Row icon={muted ? BellOff : Bell} label={muted ? "Unmute notifications" : "Mute notifications"}
              onClick={() => { const v = !muted; setMuted(v); updatePart({ is_muted: v }); }} />
            <Row icon={Star} label={pinned ? "Unpin chat" : "Pin chat"}
              onClick={() => { const v = !pinned; setPinned(v); updatePart({ is_pinned: v, pinned_at: v ? new Date().toISOString() : null }); }} />
            <Row icon={Lock} label={archived ? "Unarchive chat" : "Archive chat"}
              onClick={() => { const v = !archived; setArchived(v); updatePart({ is_archived: v }); }} />
            <Row icon={Trash2} label="Clear chat" onClick={clearChat} />
            <Row icon={Ban} label={blocked ? `Unblock ${other?.name || "user"}` : `Block ${other?.name || "user"}`} danger onClick={toggleBlock} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="rounded-3xl border-0 p-2 max-w-md bg-black">
          <button onClick={() => setPhotoOpen(false)} className="absolute right-3 top-3 z-10 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
            <X className="w-4 h-4" />
          </button>
          {other?.avatar_url ? (
            <img src={other.avatar_url} className="w-full rounded-2xl" alt={other?.name} />
          ) : (
            <div className="aspect-square rounded-2xl flex items-center justify-center text-6xl text-white">
              {other?.name?.[0] || "?"}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

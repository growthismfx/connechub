import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";

type ChatRow = {
  conversation_id: string;
  other: { id: string; name: string; avatar_url: string | null; is_online: boolean };
  last_message: string | null;
  last_message_at: string;
  unread: number;
};

export default function Chats() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const nav = useNavigate();

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = (parts || []).map((p) => p.conversation_id);
    if (!ids.length) return setRows([]);

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, last_message, last_message_at, is_group, name")
      .in("id", ids)
      .order("last_message_at", { ascending: false });

    const { data: others } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id, profiles:profiles!conversation_participants_user_id_fkey(id, name, avatar_url, is_online)")
      .in("conversation_id", ids)
      .neq("user_id", user.id);

    const map = new Map<string, any>();
    (others || []).forEach((o: any) => map.set(o.conversation_id, o.profiles));

    setRows((convs || []).map((c: any) => ({
      conversation_id: c.id,
      other: map.get(c.id) || { id: "", name: c.name || "Chat", avatar_url: null, is_online: false },
      last_message: c.last_message,
      last_message_at: c.last_message_at,
      unread: 0,
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Clubhouse</h1>
        <button onClick={() => nav("/discover")} className="w-12 h-12 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-destructive" />
        </button>
      </div>

      <button onClick={() => nav("/discover")} className="w-full flex items-center gap-3 bg-white rounded-full px-5 h-12 shadow-[var(--shadow-pill)] mb-4">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Search by username or number</span>
      </button>

      <div className="space-y-1">
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No chats yet. Find someone to message!</p>
        )}
        {rows.map((r) => (
          <button
            key={r.conversation_id}
            onClick={() => nav(`/chat/${r.conversation_id}`)}
            className="w-full flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
          >
            <div className="relative">
              <Avatar className="w-14 h-14">
                <AvatarImage src={r.other.avatar_url || undefined} />
                <AvatarFallback>{r.other.name?.[0]}</AvatarFallback>
              </Avatar>
              {r.other.is_online && (
                <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background" style={{ background: "hsl(var(--online))" }} />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold">{r.other.name}</p>
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">{r.last_message || "Say hi 👋"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">
                {r.last_message_at && formatDistanceToNow(new Date(r.last_message_at), { addSuffix: false })}
              </p>
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

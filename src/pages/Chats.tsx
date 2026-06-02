import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Settings as SettingsIcon, Plus, UserPlus, BookmarkPlus, Pin, BellOff, Users } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";

export default function Chats() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const nav = useNavigate();

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, connected_via, is_pinned, is_muted, is_archived, pinned_at")
      .eq("user_id", user.id);
    const visible = (parts || []).filter((p: any) => !p.is_archived);
    const ids = visible.map((p: any) => p.conversation_id);
    const partMap = new Map(visible.map((p: any) => [p.conversation_id, p]));
    if (!ids.length) return setRows([]);

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, last_message, last_message_at, is_group, name, avatar_url")
      .in("id", ids)
      .order("last_message_at", { ascending: false });

    const { data: others } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ids)
      .neq("user_id", user.id);

    const otherIds = [...new Set((others || []).map((o: any) => o.user_id))];
    const { data: profs } = otherIds.length
      ? await supabase.from("profiles").select("id, name, avatar_url, is_online, username").in("id", otherIds)
      : { data: [] as any[] };
    const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
    const otherMap = new Map((others || []).map((o: any) => [o.conversation_id, profMap.get(o.user_id)]));

    // Filter out conversations with blocked users
    const { data: blocks } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id);
    const blockedSet = new Set((blocks || []).map((b: any) => b.blocked_id));

    const mapped = (convs || []).map((c: any) => {
      const part: any = partMap.get(c.id);
      const convOthers = (others || []).filter((o: any) => o.conversation_id === c.id);
      const otherProfile = c.is_group
        ? { name: c.name || "Group", avatar_url: c.avatar_url, is_online: false, isGroup: true, memberCount: convOthers.length + 1 }
        : (convOthers[0] ? profMap.get(convOthers[0].user_id) : null) || { name: c.name || "Chat", avatar_url: null, is_online: false };
      const otherId = c.is_group ? null : convOthers[0]?.user_id;
      return {
        id: c.id,
        is_group: c.is_group,
        other: otherProfile,
        otherId,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        via: part?.connected_via,
        pinned: !!part?.is_pinned,
        muted: !!part?.is_muted,
      };
    }).filter((r: any) => !r.otherId || !blockedSet.has(r.otherId));

    // Sort: pinned first, then by last_message_at desc
    mapped.sort((a: any, b: any) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

    setRows(mapped);
  };

  const loadPending = async () => {
    if (!user) return;
    const { count } = await supabase.from("friend_requests").select("*", { count: "exact", head: true }).eq("to_user", user.id).eq("status", "pending");
    setPendingCount(count || 0);
  };

  useEffect(() => {
    load();
    loadPending();
    const ch = supabase.channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, loadPending)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Chats</h1>
        <div className="flex gap-2">
          <button onClick={() => nav("/requests")} className="relative w-11 h-11 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: "hsl(var(--destructive))" }}>{pendingCount}</span>
            )}
          </button>
          <button onClick={() => nav("/groups/new")} className="w-11 h-11 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center" aria-label="New group">
            <Users className="w-5 h-5" />
          </button>
          <button onClick={() => nav("/discover")} className="w-11 h-11 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </button>
          <button onClick={() => nav("/settings")} className="w-11 h-11 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button onClick={() => nav("/discover")} className="w-full flex items-center gap-3 bg-white rounded-full px-5 h-12 shadow-[var(--shadow-pill)] mb-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Search by username or phone</span>
      </button>

      <button
        onClick={async () => {
          if (!user) return;
          const { data, error } = await supabase.rpc("find_or_create_dm", { _a: user.id, _b: user.id });
          if (error || !data) return toast.error(error?.message || "Could not open self-chat");
          nav(`/chat/${data}`);
        }}
        className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-[var(--shadow-soft)] mb-4"
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
          <BookmarkPlus className="w-5 h-5" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-sm">Message yourself</p>
          <p className="text-xs text-muted-foreground">Notes, reminders & saved links</p>
        </div>
      </button>

      <div className="space-y-1">
        {rows.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
              <Plus className="w-8 h-8" />
            </div>
            <p className="text-muted-foreground">No chats yet.</p>
            <button onClick={() => nav("/discover")} className="mt-3 text-sm font-semibold underline">Find someone to message</button>
          </div>
        )}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => nav(`/chat/${r.id}`)}
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
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold truncate">{r.other.name}</p>
              <p className="text-sm text-muted-foreground truncate">{r.last_message || "Say hi 👋"}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <p className="text-xs text-muted-foreground">
                {r.last_message_at && formatDistanceToNow(new Date(r.last_message_at), { addSuffix: false })}
              </p>
              <div className="flex items-center gap-1 text-muted-foreground">
                {r.muted && <BellOff className="w-3.5 h-3.5" />}
                {r.pinned && <Pin className="w-3.5 h-3.5 fill-current" />}
              </div>
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, Pin, BellOff } from "lucide-react";

import { useNavigate } from "react-router-dom";
import NotesStrip from "@/components/NotesStrip";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";

const BASE_TABS = ["All", "Unread", "Groups", "Channels"] as const;
type Tab = string;

export default function Chats() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [q, setQ] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string; icon?: string | null }[]>([]);
  const [folderItems, setFolderItems] = useState<Record<string, Set<string>>>({});
  const nav = useNavigate();

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, connected_via, is_pinned, is_muted, is_archived")
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
        pinned: !!part?.is_pinned,
        muted: !!part?.is_muted,
      };
    }).filter((r: any) => !r.otherId || !blockedSet.has(r.otherId));

    mapped.sort((a: any, b: any) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

    setRows(mapped);
  };

  const loadStories = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("statuses")
        .select("user_id")
        .gt("expires_at", new Date().toISOString())
        .neq("user_id", user.id)
        .limit(50);
      const uids = [...new Set((data || []).map((s: any) => s.user_id))];
      if (!uids.length) return setStories([]);
      const { data: ps } = await supabase.from("profiles").select("id, name, avatar_url").in("id", uids);
      setStories(ps || []);
    } catch { setStories([]); }
  };

  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const loadUnread = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("conversation_id")
      .neq("sender_id", user.id)
      .is("read_at", null)
      .limit(500);
    const m: Record<string, number> = {};
    (data || []).forEach((r: any) => { m[r.conversation_id] = (m[r.conversation_id] || 0) + 1; });
    setUnreadMap(m);
  };

  const loadFolders = async () => {
    if (!user) return;
    const { data: fs } = await supabase.from("chat_folders" as any).select("id, name, icon").eq("user_id", user.id).order("sort_order");
    setFolders((fs || []) as any);
    const fids = (fs || []).map((f: any) => f.id);
    if (!fids.length) return setFolderItems({});
    const { data: items } = await supabase.from("chat_folder_items" as any).select("folder_id, conversation_id").in("folder_id", fids);
    const map: Record<string, Set<string>> = {};
    (items || []).forEach((it: any) => {
      map[it.folder_id] = map[it.folder_id] || new Set();
      map[it.folder_id].add(it.conversation_id);
    });
    setFolderItems(map);
  };

  useEffect(() => {
    load();
    loadStories();
    loadFolders();
    loadUnread();
    const ch = supabase.channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => { load(); loadUnread(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_folders" }, loadFolders)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_folder_items" }, loadFolders)
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, loadStories)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const createFolder = async () => {
    if (!user) return;
    const name = window.prompt("Folder name?");
    if (!name?.trim()) return;
    await supabase.from("chat_folders" as any).insert({ user_id: user.id, name: name.trim() } as any);
    loadFolders();
  };

  const toggleInFolder = async (folderId: string, conversationId: string) => {
    const inSet = folderItems[folderId]?.has(conversationId);
    if (inSet) {
      await supabase.from("chat_folder_items" as any).delete().eq("folder_id", folderId).eq("conversation_id", conversationId);
    } else {
      await supabase.from("chat_folder_items" as any).insert({ folder_id: folderId, conversation_id: conversationId } as any);
    }
    loadFolders();
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (tab === "Groups") r = r.filter((x) => x.is_group);
    else if (tab === "Channels") r = [];
    else if (tab === "Unread") r = r.filter((x) => (unreadMap[x.id] || 0) > 0);
    else if (tab !== "All") {
      const folder = folders.find((f) => f.id === tab);
      if (folder) {
        const set = folderItems[folder.id] || new Set();
        r = r.filter((x) => set.has(x.id));
      }
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((x) => (x.other.name || "").toLowerCase().includes(s) || (x.last_message || "").toLowerCase().includes(s));
    }
    return r;
  }, [rows, tab, q, folders, folderItems, unreadMap]);


  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between animate-fade-in">
        <button onClick={() => nav("/settings")} className="active:scale-95 transition-transform">
          <Avatar className="w-10 h-10 ring-2 ring-white shadow-[var(--shadow-pill)]">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
        </button>
        <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "hsl(var(--primary))" }}>hellow</h1>
        <button
          onClick={() => nav("/discover")}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform shadow-[0_6px_16px_-4px_hsl(var(--primary)/0.5)]"
          style={{ background: "var(--gradient-cta)" }}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-3 bg-white rounded-full px-5 h-12 shadow-[var(--shadow-pill)] border border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anything"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Notes */}
      <NotesStrip />

      {/* Stories */}
      <div className="px-5 mb-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-4 pb-1">
          <button
            onClick={() => nav("/status")}
            className="flex flex-col items-center gap-1.5 shrink-0 animate-fade-in"
          >
            <div className="relative">
              <Avatar className="w-[60px] h-[60px]">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{profile?.name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white border-2 border-background"
                style={{ background: "var(--gradient-cta)" }}
              >
                <Plus className="w-3 h-3" />
              </div>
            </div>
            <span className="text-[11px] font-medium">My Story</span>
          </button>
          {stories.map((s) => (
            <button
              key={s.id}
              onClick={() => nav("/status")}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="status-ring-unseen">
                <Avatar className="w-[54px] h-[54px] border-2 border-background">
                  <AvatarImage src={s.avatar_url || undefined} />
                  <AvatarFallback>{s.name?.[0]}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[11px] font-medium truncate max-w-[64px]">{s.name?.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 items-center">
          {[...BASE_TABS, ...folders.map((f) => f.name)].map((label, idx) => {
            const key = idx < BASE_TABS.length ? label : folders[idx - BASE_TABS.length].id;
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-4 h-8 rounded-full text-sm font-medium transition-all active:scale-95 whitespace-nowrap"
                style={{
                  background: active ? "var(--gradient-cta)" : "hsl(var(--muted))",
                  color: active ? "white" : "hsl(var(--muted-foreground))",
                  boxShadow: active ? "var(--shadow-pill)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
          <button
            onClick={createFolder}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground border border-dashed border-border shrink-0 active:scale-95"
            aria-label="Add folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>


      {/* List */}
      <div className="px-5">
        {filtered.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
              <Plus className="w-8 h-8" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <p className="text-muted-foreground">{tab === "Channels" ? "No channels yet" : "No chats here"}</p>
            <button onClick={() => nav("/discover")} className="mt-3 text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>Find someone to message</button>
          </div>
        )}
        {filtered.map((r, idx) => (
          <button
            key={r.id}
            onClick={() => nav(`/chat/${r.id}`)}
            className="w-full flex items-center gap-3 py-3 active:scale-[0.99] transition-transform animate-fade-in"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="relative">
              <Avatar className="w-[52px] h-[52px]">
                <AvatarImage src={r.other.avatar_url || undefined} />
                <AvatarFallback>{r.other.name?.[0]}</AvatarFallback>
              </Avatar>
              {r.other.is_online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background" style={{ background: "hsl(var(--online))" }} />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold truncate text-[15px]">{r.other.name}</p>
              <p className="text-[13px] text-muted-foreground truncate">{r.last_message || "Say hi 👋"}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <p className="text-[11px] text-muted-foreground">
                {r.last_message_at && formatDistanceToNow(new Date(r.last_message_at), { addSuffix: false })}
              </p>
              <div className="flex items-center gap-1 text-muted-foreground">
                {r.muted && <BellOff className="w-3 h-3" />}
                {r.pinned && <Pin className="w-3 h-3 fill-current" />}
              </div>
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

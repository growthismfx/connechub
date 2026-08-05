import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, Pin, BellOff, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NotesStrip from "@/components/NotesStrip";
import BottomNav from "@/components/BottomNav";
import AmbientBackdrop from "@/components/AmbientBackdrop";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { formatDistanceToNow } from "date-fns";

const spring = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };
const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: spring },
};

const BASE_TABS = ["All", "Unread", "Groups", "Channels"] as const;
type Tab = string;

// Older messages were stored encrypted; never show raw ciphertext in previews.
const looksLikeCiphertext = (s: string) =>
  s.length > 22 && !s.includes(" ") && /^[A-Za-z0-9+/=]+$/.test(s);

const previewText = (s?: string | null) => {
  if (!s) return "Say hi 👋";
  return looksLikeCiphertext(s) ? "🔒 Encrypted message" : s;
};

export default function Chats() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string; icon?: string | null }[]>([]);
  const [folderItems, setFolderItems] = useState<Record<string, Set<string>>>({});
  const nav = useNavigate();
  const storyRef = useRef<HTMLDivElement>(null);

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

  // GSAP: buttery staggered entrance for the story rail (GPU transforms only)
  useEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-story]", {
        y: 22, opacity: 0, scale: 0.86, duration: 0.65,
        ease: "power3.out", stagger: 0.055, force3D: true, clearProps: "all",
      });
    }, el);
    return () => ctx.revert();
  }, [stories.length]);

  const createFolder = async () => {
    if (!user) return;
    const name = window.prompt("Folder name?");
    if (!name?.trim()) return;
    await supabase.from("chat_folders" as any).insert({ user_id: user.id, name: name.trim() } as any);
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
    <div className="min-h-screen pb-36 relative">
      <AmbientBackdrop variant="chat" />

      {/* Header — bold "Chat" + round white search / more buttons */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="px-6 pt-12 pb-5 flex items-center justify-between"
        style={{ willChange: "transform" }}
      >
        <h1 className="text-[32px] font-bold tracking-tight leading-none">Chat</h1>
        <div className="flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ y: -1 }}
            transition={spring}
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-[0_10px_22px_-12px_rgba(20,60,120,0.7)]"
            style={{ willChange: "transform" }}
          >
            <Search className="w-[18px] h-[18px] text-foreground" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ y: -1 }}
            transition={spring}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More"
            className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-[0_10px_22px_-12px_rgba(20,60,120,0.7)]"
            style={{ willChange: "transform" }}
          >
            <MoreHorizontal className="w-[18px] h-[18px] text-foreground" />
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            key="search"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4">
              <div className="flex items-center gap-3 bg-white rounded-full px-5 h-11 shadow-[0_10px_22px_-14px_rgba(20,60,120,0.7)]">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </motion.div>
        )}

        {menuOpen && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={spring}
            className="px-6 pb-4"
            style={{ willChange: "transform" }}
          >
            <div className="bg-white rounded-3xl p-2 shadow-[0_16px_34px_-18px_rgba(20,60,120,0.75)] flex flex-col">
              {[...BASE_TABS, ...folders.map((f) => f.name)].map((label, idx) => {
                const key = idx < BASE_TABS.length ? label : folders[idx - BASE_TABS.length].id;
                return (
                  <button
                    key={key}
                    onClick={() => { setTab(key); setMenuOpen(false); }}
                    className={`text-left text-sm px-4 py-2.5 rounded-2xl transition-colors ${tab === key ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
                  >
                    {label}
                  </button>
                );
              })}
              <button onClick={() => { setMenuOpen(false); createFolder(); }} className="text-left text-sm px-4 py-2.5 rounded-2xl text-muted-foreground hover:bg-muted/60">
                + New folder
              </button>
              <button onClick={() => { setMenuOpen(false); nav("/settings"); }} className="text-left text-sm px-4 py-2.5 rounded-2xl text-muted-foreground hover:bg-muted/60">
                Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story rail — big circular avatars with names underneath */}
      <div ref={storyRef} className="pl-6 pb-1 overflow-x-auto no-scrollbar">
        <div className="flex gap-4 pr-6">
          <motion.button
            data-story
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -2 }}
            transition={spring}
            onClick={() => nav("/status")}
            className="flex flex-col items-center gap-2 shrink-0"
            style={{ willChange: "transform" }}
          >
            <div className="relative">
              <Avatar className="w-[62px] h-[62px] border-[3px] border-white shadow-[0_12px_22px_-12px_rgba(20,60,120,0.8)]">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{profile?.name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white text-white"
                style={{ background: "var(--gradient-cta)" }}
              >
                <Plus className="w-3 h-3" />
              </span>
            </div>
            <span className="text-[12px] text-foreground/75">You</span>
          </motion.button>

          {stories.map((s) => (
            <motion.button
              key={s.id}
              data-story
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -2 }}
              transition={spring}
              onClick={() => nav("/status")}
              className="flex flex-col items-center gap-2 shrink-0"
              style={{ willChange: "transform" }}
            >
              <div className="rounded-full p-[2.5px]" style={{ background: "var(--gradient-cta)" }}>
                <Avatar className="w-[58px] h-[58px] border-[2.5px] border-white">
                  <AvatarImage src={s.avatar_url || undefined} />
                  <AvatarFallback>{s.name?.[0]}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[12px] text-foreground/75 truncate max-w-[64px]">{s.name?.split(" ")[0]}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <NotesStrip />

      <p className="px-6 pt-4 pb-1 text-[15px] font-semibold">Messages</p>

      {filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <p className="text-muted-foreground text-sm">No chats here yet</p>
          <button onClick={() => nav("/discover")} className="mt-2 text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>
            Find someone to message
          </button>
        </motion.div>
      )}

      <motion.div
        className="px-4"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } } }}
      >
        <AnimatePresence initial={false}>
          {filtered.map((r) => {
            const unread = unreadMap[r.id] || 0;
            return (
              <motion.button
                key={r.id}
                layout
                variants={rowVariants}
                exit={{ opacity: 0, x: -20 }}
                whileTap={{ scale: 0.985 }}
                transition={spring}
                onClick={() => nav(`/chat/${r.id}`)}
                className="w-full flex items-center gap-3.5 px-2 py-3 rounded-2xl hover:bg-white/60 active:bg-white/80 transition-colors"
                style={{ willChange: "transform" }}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-[48px] h-[48px]">
                    <AvatarImage src={r.other.avatar_url || undefined} />
                    <AvatarFallback>{r.other.name?.[0]}</AvatarFallback>
                  </Avatar>
                  {r.other.is_online && (
                    <span
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
                      style={{ background: "hsl(var(--online))" }}
                    />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-[15px] truncate leading-tight">{r.other.name}</p>
                  <p className={`text-[13px] truncate mt-0.5 ${unread > 0 ? "text-foreground/80" : "text-muted-foreground"}`}>
                    {previewText(r.last_message)}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {r.last_message_at && formatDistanceToNow(new Date(r.last_message_at), { addSuffix: false })}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {r.muted && <BellOff className="w-3 h-3" />}
                    {r.pinned && <Pin className="w-3 h-3 fill-current" />}
                    {unread > 0 && (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={spring}
                        className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
                      >
                        {unread > 99 ? "99+" : unread}
                      </motion.span>
                    )}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <BottomNav />
    </div>
  );
}

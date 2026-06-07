import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, AtSign, Phone, ChevronRight, Users, Plus, UserPlus, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const GRADIENTS = [
  "from-amber-300 to-rose-300",
  "from-sky-300 to-emerald-300",
  "from-fuchsia-300 to-violet-400",
  "from-indigo-300 to-blue-400",
  "from-pink-300 to-orange-300",
  "from-teal-300 to-cyan-400",
];

export default function Discover() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [matchType, setMatchType] = useState<"username" | "phone" | "name">("username");
  const [communities, setCommunities] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [cname, setCName] = useState("");
  const [cdesc, setCDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  const loadCommunities = async () => {
    const { data } = await (supabase as any).from("communities").select("*").order("member_count", { ascending: false }).limit(30);
    setCommunities(data || []);
    if (user) {
      const { data: m } = await (supabase as any).from("community_members").select("community_id").eq("user_id", user.id);
      setJoinedIds(new Set((m || []).map((x: any) => x.community_id)));
    }
  };

  const loadGroups = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = (parts || []).map((p: any) => p.conversation_id);
    if (!ids.length) return setMyGroups([]);
    const { data } = await supabase
      .from("conversations")
      .select("id, name, avatar_url, is_group, last_message")
      .in("id", ids)
      .eq("is_group", true)
      .order("last_message_at", { ascending: false })
      .limit(20);
    setMyGroups(data || []);
  };

  useEffect(() => {
    loadCommunities();
    loadGroups();
    const ch = supabase.channel("explore")
      .on("postgres_changes", { event: "*", schema: "public", table: "communities" }, loadCommunities)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members" }, loadCommunities)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      const isDigits = /^[0-9+]+$/.test(term);
      const cleaned = term.replace(/\D/g, "");
      let query = supabase
        .from("profiles")
        .select("id, name, username, avatar_url, assigned_number, country_code, is_online")
        .neq("id", user?.id || "");
      if (isDigits) {
        if (cleaned.length < 10) { setResults([]); setMatchType("phone"); return; }
        query = query.eq("assigned_number", cleaned.slice(-10));
        setMatchType("phone");
      } else {
        query = query.or(`username.ilike.%${term}%,name.ilike.%${term}%`);
        setMatchType("username");
      }
      const { data } = await query.limit(20);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user]);

  const createCommunity = async () => {
    if (!user || !cname.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("communities").insert({
      name: cname.trim(), description: cdesc.trim() || null, created_by: user.id, is_public: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Community created");
    setCreateOpen(false); setCName(""); setCDesc("");
    loadCommunities();
  };

  const toggleJoin = async (c: any) => {
    if (!user) return;
    const joined = joinedIds.has(c.id);
    if (joined) {
      await (supabase as any).from("community_members").delete().eq("community_id", c.id).eq("user_id", user.id);
      toast("Left community");
    } else {
      const { error } = await (supabase as any).from("community_members").insert({ community_id: c.id, user_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Joined!");
    }
    loadCommunities();
  };

  const formatMembers = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K members` : `${n} member${n === 1 ? "" : "s"}`;

  return (
    <div className="min-h-screen pb-32">
      <div className="px-5 pt-12 pb-3 flex items-center justify-between animate-fade-in">
        <h1 className="text-[26px] font-bold tracking-tight">Explore</h1>
        <button onClick={() => setCreateOpen(true)} className="w-10 h-10 rounded-full text-white flex items-center justify-center shadow-[var(--shadow-pill)] active:scale-95 transition-transform" style={{ background: "var(--gradient-cta)" }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Hero banner */}
      <div className="px-5 mb-5">
        <div
          className="relative rounded-3xl p-5 text-white overflow-hidden shadow-[var(--shadow-bubble)] animate-scale-in"
          style={{ background: "var(--gradient-cta)" }}
        >
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute right-10 top-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative">
            <h2 className="text-lg font-bold leading-tight max-w-[70%]">Discover communities<br/>and connect with people</h2>
            <button onClick={() => setCreateOpen(true)} className="mt-4 px-5 h-9 rounded-full bg-white text-[13px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
              Create one
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-3 bg-white rounded-full px-5 h-12 shadow-[var(--shadow-pill)] border border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, @username or phone"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Search results */}
      {q.trim() && (
        <div className="px-5 mb-6 space-y-2">
          <p className="text-[11px] text-muted-foreground px-3 flex items-center gap-1.5">
            {matchType === "phone" ? <Phone className="w-3 h-3" /> : <AtSign className="w-3 h-3" />}
            Searching by {matchType === "phone" ? "phone" : "username"}
          </p>
          {results.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">No matches</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => nav(`/chat/new/${p.id}?via=${matchType === "phone" ? "phone" : "username"}`)}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] active:scale-[0.99] transition-transform animate-fade-in"
            >
              <Avatar className="w-11 h-11">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback>{p.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold truncate text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {!q.trim() && (
        <>
          {/* Groups */}
          <div className="px-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[15px]">Your Groups</h3>
              <button onClick={() => nav("/groups/new")} className="text-sm font-medium flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}>
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            {myGroups.length === 0 ? (
              <button onClick={() => nav("/groups/new")} className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-[var(--shadow-soft)] active:scale-[0.99] transition-transform">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--gradient-cta)" }}>
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">Create a new group</p>
                  <p className="text-xs text-muted-foreground">Chat with friends, family or team</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ) : (
              <div className="space-y-2">
                {myGroups.map((g, i) => (
                  <button
                    key={g.id}
                    onClick={() => nav(`/chat/${g.id}`)}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] active:scale-[0.99] transition-transform animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={g.avatar_url || undefined} />
                      <AvatarFallback><Users className="w-5 h-5" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm truncate">{g.name || "Group"}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.last_message || "Tap to chat"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Communities */}
          <div className="px-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[15px]">Communities</h3>
              <button onClick={() => setCreateOpen(true)} className="text-sm font-medium flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}>
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </div>
            {communities.length === 0 && (
              <div className="text-center py-10 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
                <Globe className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No communities yet</p>
                <button onClick={() => setCreateOpen(true)} className="mt-2 text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>Be the first to create one</button>
              </div>
            )}
            <div className="space-y-2">
              {communities.map((c, i) => {
                const joined = joinedIds.has(c.id);
                const g = GRADIENTS[i % GRADIENTS.length];
                return (
                  <div
                    key={c.id}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {c.avatar_url ? (
                      <Avatar className="w-11 h-11 rounded-xl"><AvatarImage src={c.avatar_url} /><AvatarFallback>{c.name?.[0]}</AvatarFallback></Avatar>
                    ) : (
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${g} flex items-center justify-center shrink-0`}>
                        <Users className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{formatMembers(c.member_count)}</p>
                    </div>
                    <button
                      onClick={() => toggleJoin(c)}
                      className="px-3.5 h-8 rounded-full text-xs font-semibold transition-all active:scale-95"
                      style={{
                        background: joined ? "hsl(var(--muted))" : "var(--gradient-cta)",
                        color: joined ? "hsl(var(--muted-foreground))" : "white",
                      }}
                    >
                      {joined ? "Joined" : "Join"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Create community</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={cname} onChange={(e) => setCName(e.target.value)} placeholder="Community name" className="rounded-full h-12" />
            <Textarea value={cdesc} onChange={(e) => setCDesc(e.target.value)} placeholder="What is it about?" className="rounded-2xl" rows={3} />
            <Button onClick={createCommunity} disabled={saving || !cname.trim()} className="w-full rounded-full h-12 text-white border-0" style={{ background: "var(--gradient-cta)" }}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

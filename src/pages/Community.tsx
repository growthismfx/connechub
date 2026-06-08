import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, Send, Image as ImageIcon, Trash2, Settings as Cog, LogOut, Globe, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<"feed" | "members" | "about">("feed");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const isAdmin = c && user && c.created_by === user.id;
  const isMember = members.some((m) => m.user_id === user?.id);

  const load = async () => {
    const { data: comm } = await (supabase as any).from("communities").select("*").eq("id", id).maybeSingle();
    setC(comm);
    if (comm) { setEditName(comm.name); setEditDesc(comm.description || ""); setEditPublic(comm.is_public); }
    const { data: mems } = await (supabase as any).from("community_members").select("user_id, role, joined_at").eq("community_id", id);
    if (mems?.length) {
      const ids = mems.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      setMembers(mems.map((m: any) => ({ ...m, profile: map.get(m.user_id) })));
    } else setMembers([]);
    const { data: ps } = await (supabase as any).from("community_posts").select("*").eq("community_id", id).order("created_at", { ascending: false }).limit(60);
    if (ps?.length) {
      const aids = [...new Set(ps.map((p: any) => p.author_id))];
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", aids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      setPosts(ps.map((p: any) => ({ ...p, author: map.get(p.author_id) })));
    } else setPosts([]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`community-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: `community_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members", filter: `community_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const join = async () => {
    if (!user) return;
    const { error } = await (supabase as any).from("community_members").insert({ community_id: id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Joined community");
    load();
  };
  const leave = async () => {
    if (!user) return;
    await (supabase as any).from("community_members").delete().eq("community_id", id).eq("user_id", user.id);
    toast("Left community");
    load();
  };

  const post = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await (supabase as any).from("community_posts").insert({ community_id: id, author_id: user.id, content: text.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  const postImage = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/community-${id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    await (supabase as any).from("community_posts").insert({ community_id: id, author_id: user.id, media_url: data?.signedUrl });
  };

  const deletePost = async (pid: string) => {
    await (supabase as any).from("community_posts").delete().eq("id", pid);
  };

  const saveSettings = async () => {
    await (supabase as any).from("communities").update({ name: editName.trim(), description: editDesc.trim() || null, is_public: editPublic }).eq("id", id);
    setEditOpen(false); toast.success("Updated"); load();
  };
  const deleteCommunity = async () => {
    if (!confirm("Delete this community? This cannot be undone.")) return;
    await (supabase as any).from("communities").delete().eq("id", id);
    nav("/discover");
  };

  if (!c) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen pb-32">
      {/* Hero */}
      <div className="relative px-5 pt-12 pb-6 text-white overflow-hidden" style={{ background: "var(--gradient-cta)", backgroundSize: "200% 200%", animation: "gradient-shift 8s ease infinite" }}>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute right-16 -top-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between mb-5">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {isAdmin && (
            <button onClick={() => setEditOpen(true)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Cog className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="relative flex items-center gap-4">
          <Avatar className="w-20 h-20 ring-4 ring-white/30">
            <AvatarImage src={c.avatar_url || undefined} />
            <AvatarFallback className="text-2xl"><Users /></AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{c.name}</h1>
            <p className="text-sm text-white/90 flex items-center gap-1.5 mt-0.5">
              {c.is_public ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {c.member_count} member{c.member_count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="relative mt-5 flex gap-2">
          {isMember ? (
            <button onClick={leave} className="flex-1 h-11 rounded-full bg-white/15 backdrop-blur text-sm font-semibold flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Leave
            </button>
          ) : (
            <button onClick={join} className="flex-1 h-11 rounded-full bg-white text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>
              Join community
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 -mt-3">
        <div className="flex bg-white rounded-full p-1 shadow-[var(--shadow-pill)]">
          {(["feed", "members", "about"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 h-9 rounded-full text-xs font-semibold capitalize transition-all"
              style={tab === t ? { background: "var(--gradient-cta)", color: "white" } : { color: "hsl(var(--muted-foreground))" }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3">
        {tab === "feed" && (
          <>
            {isMember && (
              <div className="bg-white rounded-2xl p-3 shadow-[var(--shadow-soft)] space-y-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share something with the community…" rows={2} className="border-0 resize-none focus-visible:ring-0" />
                <div className="flex items-center justify-between">
                  <button onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && postImage(e.target.files[0])} />
                  <Button onClick={post} disabled={!text.trim() || sending} className="rounded-full h-9 border-0 text-white" style={{ background: "var(--gradient-cta)" }}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Post
                  </Button>
                </div>
              </div>
            )}
            {posts.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-10">No posts yet. Be the first!</p>
            )}
            {posts.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl p-4 shadow-[var(--shadow-soft)] animate-fade-in">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="w-9 h-9"><AvatarImage src={p.author?.avatar_url || undefined} /><AvatarFallback>{p.author?.name?.[0] || "?"}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.author?.name || "Member"}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                  </div>
                  {(p.author_id === user?.id || isAdmin) && (
                    <button onClick={() => deletePost(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {p.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>}
                {p.media_url && <img src={p.media_url} alt="" className="mt-2 rounded-xl w-full" />}
              </div>
            ))}
          </>
        )}

        {tab === "members" && (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
                <Avatar className="w-10 h-10"><AvatarImage src={m.profile?.avatar_url || undefined} /><AvatarFallback>{m.profile?.name?.[0] || "?"}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.profile?.name || "Member"}</p>
                  <p className="text-[11px] text-muted-foreground">@{m.profile?.username || "—"}</p>
                </div>
                {m.role === "admin" && <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: "var(--gradient-cta)" }}>ADMIN</span>}
              </div>
            ))}
          </div>
        )}

        {tab === "about" && (
          <div className="bg-white rounded-2xl p-4 shadow-[var(--shadow-soft)] space-y-3">
            <div>
              <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{c.description || "No description yet."}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {c.is_public ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {c.is_public ? "Public community" : "Private community"}
            </div>
            {isAdmin && (
              <button onClick={deleteCommunity} className="w-full mt-2 h-10 rounded-full text-sm font-semibold text-destructive border border-destructive/30">
                Delete community
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Edit community</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="rounded-full h-12" />
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={3} className="rounded-2xl" />
            <label className="flex items-center justify-between p-3 rounded-2xl bg-muted">
              <span className="text-sm font-medium">Public</span>
              <input type="checkbox" checked={editPublic} onChange={(e) => setEditPublic(e.target.checked)} />
            </label>
            <Button onClick={saveSettings} className="w-full rounded-full h-12 text-white border-0" style={{ background: "var(--gradient-cta)" }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

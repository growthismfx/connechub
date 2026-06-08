import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, Pencil, Camera, UserPlus, Phone, Video, Bell, BellOff, LogOut, Trash2, Crown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createOrGetActiveCall } from "@/lib/callHelpers";

export default function GroupSettings() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [conv, setConv] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [callPickerOpen, setCallPickerOpen] = useState<null | "voice" | "video">(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = me?.role === "admin";

  const load = async () => {
    const { data: c } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
    setConv(c); setNewName(c?.name || "");
    const { data: parts } = await supabase.from("conversation_participants").select("*").eq("conversation_id", id);
    if (parts?.length) {
      const ids = parts.map((p: any) => p.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, name, username, avatar_url, is_online").in("id", ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      const merged = parts.map((p: any) => ({ ...p, profile: map.get(p.user_id) }));
      setMembers(merged);
      setMe(merged.find((p: any) => p.user_id === user?.id));
    }
  };

  useEffect(() => { if (user) load(); }, [id, user]);

  const rename = async () => {
    if (!newName.trim()) return;
    await supabase.from("conversations").update({ name: newName.trim() }).eq("id", id);
    setRenaming(false); toast.success("Renamed"); load();
  };

  const changeAvatar = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/group-${id}-${Date.now()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("conversations").update({ avatar_url: data.publicUrl }).eq("id", id);
    toast.success("Photo updated"); load();
  };

  const toggleMute = async () => {
    if (!me) return;
    await supabase.from("conversation_participants").update({ is_muted: !me.is_muted }).eq("conversation_id", id).eq("user_id", user!.id);
    load();
  };

  const leave = async () => {
    if (!confirm("Leave this group?")) return;
    await supabase.from("conversation_participants").delete().eq("conversation_id", id).eq("user_id", user!.id);
    nav("/chats");
  };

  const removeMember = async (uid: string) => {
    if (!confirm("Remove this member?")) return;
    await supabase.from("conversation_participants").delete().eq("conversation_id", id).eq("user_id", uid);
    load();
  };

  const promote = async (uid: string) => {
    await supabase.from("conversation_participants").update({ role: "admin" }).eq("conversation_id", id).eq("user_id", uid);
    load();
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!searchQ.trim()) { setSearchResults([]); return; }
      const existing = new Set(members.map((m) => m.user_id));
      const { data } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .or(`username.ilike.%${searchQ}%,name.ilike.%${searchQ}%`)
        .limit(15);
      setSearchResults((data || []).filter((p: any) => !existing.has(p.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ, members]);

  const addMember = async (uid: string) => {
    const { error } = await supabase.from("conversation_participants").insert({ conversation_id: id!, user_id: uid });
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setSearchQ(""); setSearchResults([]); load();
  };

  const callMember = async (uid: string, type: "voice" | "video") => {
    if (!user) return;
    const { data, error } = await createOrGetActiveCall({ callerId: user.id, calleeId: uid, callType: type });
    if (error || !data) return toast.error(error?.message || "Call failed");
    setCallPickerOpen(null);
    nav(`/call/${data.id}?role=caller`);
  };

  if (!conv) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen pb-20">
      <div className="relative px-5 pt-12 pb-8 text-white overflow-hidden" style={{ background: "var(--gradient-cta)", backgroundSize: "200% 200%", animation: "gradient-shift 8s ease infinite" }}>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-4">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <Avatar className="w-24 h-24 ring-4 ring-white/30">
              <AvatarImage src={conv.avatar_url || undefined} />
              <AvatarFallback className="text-3xl"><Users /></AvatarFallback>
            </Avatar>
            {isAdmin && (
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white text-foreground flex items-center justify-center shadow-lg">
                <Camera className="w-4 h-4" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && changeAvatar(e.target.files[0])} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-2xl font-bold">{conv.name || "Group"}</h1>
            {isAdmin && (
              <button onClick={() => setRenaming(true)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm text-white/90 mt-1">{members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 -mt-4">
        <div className="grid grid-cols-4 gap-2 bg-white rounded-2xl p-3 shadow-[var(--shadow-pill)]">
          <button onClick={() => setCallPickerOpen("voice")} className="flex flex-col items-center gap-1 py-2 active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-cta)" }}><Phone className="w-5 h-5" /></div>
            <span className="text-[10px] font-medium">Call</span>
          </button>
          <button onClick={() => setCallPickerOpen("video")} className="flex flex-col items-center gap-1 py-2 active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-cta)" }}><Video className="w-5 h-5" /></div>
            <span className="text-[10px] font-medium">Video</span>
          </button>
          <button onClick={toggleMute} className="flex flex-col items-center gap-1 py-2 active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-muted">
              {me?.is_muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <span className="text-[10px] font-medium">{me?.is_muted ? "Unmute" : "Mute"}</span>
          </button>
          <button onClick={() => setAddOpen(true)} className="flex flex-col items-center gap-1 py-2 active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-muted"><UserPlus className="w-5 h-5" /></div>
            <span className="text-[10px] font-medium">Add</span>
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="px-5 mt-6">
        <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-2 px-2">Members</p>
        <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] divide-y divide-border/40 overflow-hidden">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 p-3 animate-fade-in">
              <div className="relative">
                <Avatar className="w-10 h-10"><AvatarImage src={m.profile?.avatar_url || undefined} /><AvatarFallback>{m.profile?.name?.[0]}</AvatarFallback></Avatar>
                {m.profile?.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {m.user_id === user?.id ? "You" : m.profile?.name || "Member"}
                  {m.role === "admin" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">@{m.profile?.username || "—"}</p>
              </div>
              {isAdmin && m.user_id !== user?.id && (
                <div className="flex gap-1">
                  {m.role !== "admin" && (
                    <button onClick={() => promote(m.user_id)} className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center" title="Make admin">
                      <Crown className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => removeMember(m.user_id)} className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6">
        <button onClick={leave} className="w-full p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] flex items-center gap-3 text-destructive font-semibold text-sm active:scale-[0.99] transition-transform">
          <LogOut className="w-5 h-5" /> Leave group
        </button>
      </div>

      {/* Rename dialog */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Rename group</DialogTitle></DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-full h-12" />
          <Button onClick={rename} className="w-full rounded-full h-12 text-white border-0" style={{ background: "var(--gradient-cta)" }}>Save</Button>
        </DialogContent>
      </Dialog>

      {/* Add member */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 bg-muted rounded-full px-4 h-11">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search username or name" className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {searchResults.map((p) => (
              <button key={p.id} onClick={() => addMember(p.id)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted">
                <Avatar className="w-9 h-9"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{p.name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">@{p.username}</p>
                </div>
                <UserPlus className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Call picker */}
      <Dialog open={!!callPickerOpen} onOpenChange={() => setCallPickerOpen(null)}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Pick a member to {callPickerOpen === "video" ? "video " : ""}call</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {members.filter((m) => m.user_id !== user?.id).map((m) => (
              <button key={m.user_id} onClick={() => callMember(m.user_id, callPickerOpen!)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted">
                <Avatar className="w-9 h-9"><AvatarImage src={m.profile?.avatar_url || undefined} /><AvatarFallback>{m.profile?.name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate">{m.profile?.name}</p>
                </div>
                {callPickerOpen === "video" ? <Video className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} /> : <Phone className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, UserX, Trash2, Star, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PrivacySettings() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [readReceipts, setReadReceipts] = useState(true);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [showPhoto, setShowPhoto] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [closeFriends, setCloseFriends] = useState<any[]>([]);
  const [cfSearch, setCfSearch] = useState("");
  const [cfResults, setCfResults] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    setReadReceipts(profile.read_receipts ?? true);
    setShowLastSeen(profile.show_last_seen ?? true);
    setShowPhoto(profile.show_profile_photo ?? true);
    setShowStatus(profile.show_status ?? true);
  }, [profile]);

  const loadBlocked = async () => {
    if (!user) return;
    const { data } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id);
    const ids = (data || []).map((b: any) => b.blocked_id);
    if (!ids.length) return setBlocked([]);
    const { data: profs } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", ids);
    setBlocked(profs || []);
  };

  useEffect(() => { loadBlocked(); loadCloseFriends(); }, [user?.id]);

  const loadCloseFriends = async () => {
    if (!user) return;
    const { data } = await supabase.from("close_friends").select("friend_id").eq("user_id", user.id);
    const ids = (data || []).map((r: any) => r.friend_id);
    if (!ids.length) return setCloseFriends([]);
    const { data: profs } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", ids);
    setCloseFriends(profs || []);
  };

  useEffect(() => {
    if (!cfSearch.trim() || !user) { setCfResults([]); return; }
    const t = setTimeout(async () => {
      const q = cfSearch.trim();
      const { data } = await supabase.from("profiles")
        .select("id, name, username, avatar_url")
        .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
        .neq("id", user.id)
        .limit(8);
      const existing = new Set(closeFriends.map((c) => c.id));
      setCfResults((data || []).filter((p: any) => !existing.has(p.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [cfSearch, user?.id, closeFriends]);

  const addCloseFriend = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("close_friends").insert({ user_id: user.id, friend_id: id });
    if (error) return toast.error(error.message);
    setCfSearch(""); setCfResults([]);
    toast.success("Added to Close Friends"); loadCloseFriends();
  };

  const removeCloseFriend = async (id: string) => {
    if (!user) return;
    await supabase.from("close_friends").delete().eq("user_id", user.id).eq("friend_id", id);
    toast.success("Removed"); loadCloseFriends();
  };


  const update = async (patch: any) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
  };


  const unblock = async (id: string) => {
    if (!user) return;
    await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    toast.success("Unblocked"); loadBlocked();
  };

  const Row = ({ label, sub, checked, onChange }: any) => (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-bold">Privacy</h1>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4 divide-y divide-border/40">
        <Row label="Read receipts" sub="Show when you've read messages" checked={readReceipts} onChange={(v: boolean) => { setReadReceipts(v); update({ read_receipts: v }); }} />
        <Row label="Last seen & online" sub="Let others see when you were last active" checked={showLastSeen} onChange={(v: boolean) => { setShowLastSeen(v); update({ show_last_seen: v }); }} />
        <Row label="Profile photo" sub="Visible to people you chat with" checked={showPhoto} onChange={(v: boolean) => { setShowPhoto(v); update({ show_profile_photo: v }); }} />
        <Row label="About / status" sub="Show your bio on your profile" checked={showStatus} onChange={(v: boolean) => { setShowStatus(v); update({ show_status: v }); }} />
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Star className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">Close Friends</p>
            <p className="text-xs text-muted-foreground">{closeFriends.length} people can see your "Close" stories</p>
          </div>
        </div>
        <div className="relative mb-2">
          <Input value={cfSearch} onChange={(e) => setCfSearch(e.target.value)} placeholder="Search by name or @username" className="rounded-full h-10" />
          {cfResults.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-border/40 overflow-hidden">
              {cfResults.map((p) => (
                <button key={p.id} onClick={() => addCloseFriend(p.id)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted">
                  <Avatar className="w-8 h-8"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{p.name?.[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                  <Plus className="w-4 h-4 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
        {closeFriends.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No close friends yet</p>}
        <div className="space-y-2">
          {closeFriends.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-t">
              <Avatar className="w-10 h-10"><AvatarImage src={c.avatar_url || undefined} /><AvatarFallback>{c.name?.[0]}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{c.username}</p>
              </div>
              <button onClick={() => removeCloseFriend(c.id)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center" aria-label="Remove">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>


      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"><UserX className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">Blocked contacts</p>
            <p className="text-xs text-muted-foreground">{blocked.length} blocked</p>
          </div>
        </div>
        {blocked.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No blocked contacts</p>}
        <div className="space-y-2">
          {blocked.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-t">
              <Avatar className="w-10 h-10"><AvatarImage src={b.avatar_url || undefined} /><AvatarFallback>{b.name?.[0]}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{b.username}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => unblock(b.id)} className="rounded-full">Unblock</Button>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

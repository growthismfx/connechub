import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, UserX, Trash2 } from "lucide-react";
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

  useEffect(() => { loadBlocked(); }, [user?.id]);

  const update = async (patch: Record<string, any>) => {
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

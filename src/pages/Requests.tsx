import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Requests() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: inc } = await supabase.from("friend_requests").select("*").eq("to_user", user.id).eq("status", "pending");
    const { data: out } = await supabase.from("friend_requests").select("*").eq("from_user", user.id).eq("status", "pending");
    const ids = [...new Set([...(inc || []).map((r: any) => r.from_user), ...(out || []).map((r: any) => r.to_user)])];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id, name, avatar_url, username").in("id", ids) : { data: [] as any[] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setIncoming((inc || []).map((r: any) => ({ ...r, profile: map.get(r.from_user) })));
    setOutgoing((out || []).map((r: any) => ({ ...r, profile: map.get(r.to_user) })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("frq").on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const accept = async (r: any) => {
    if (!user) return;
    const { error } = await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    // Open or create conversation immediately
    nav(`/chat/new/${r.from_user}?via=username`);
  };
  const reject = async (r: any) => {
    await supabase.from("friend_requests").delete().eq("id", r.id);
  };
  const cancel = async (r: any) => {
    await supabase.from("friend_requests").delete().eq("id", r.id);
  };

  return (
    <div className="min-h-screen pb-20 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Chat requests</h1>
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-2">Incoming</p>
      <div className="space-y-2 mb-6">
        {incoming.length === 0 && <p className="text-sm text-muted-foreground px-2">No incoming requests</p>}
        {incoming.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
            <Avatar className="w-12 h-12"><AvatarImage src={r.profile?.avatar_url || undefined} /><AvatarFallback>{r.profile?.name?.[0]}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.profile?.name}</p>
              <p className="text-xs text-muted-foreground truncate">@{r.profile?.username}</p>
            </div>
            <button onClick={() => reject(r)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            <button onClick={() => accept(r)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-cta)" }}><Check className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-2">Sent</p>
      <div className="space-y-2">
        {outgoing.length === 0 && <p className="text-sm text-muted-foreground px-2">No sent requests</p>}
        {outgoing.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
            <Avatar className="w-12 h-12"><AvatarImage src={r.profile?.avatar_url || undefined} /><AvatarFallback>{r.profile?.name?.[0]}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.profile?.name}</p>
              <p className="text-xs text-muted-foreground truncate">@{r.profile?.username} · pending</p>
            </div>
            <button onClick={() => cancel(r)} className="px-3 h-9 rounded-full bg-muted text-xs">Cancel</button>
          </div>
        ))}
      </div>
    </div>
  );
}

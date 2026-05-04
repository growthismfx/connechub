import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createOrGetActiveCall } from "@/lib/callHelpers";

export default function Calls() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [calls, setCalls] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("calls")
      .select("*")
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = [...new Set((data || []).flatMap((c: any) => [c.caller_id, c.callee_id]))];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id, name, avatar_url, username").in("id", ids) : { data: [] as any[] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setCalls((data || []).map((c: any) => ({
      ...c,
      other: c.caller_id === user.id ? map.get(c.callee_id) : map.get(c.caller_id),
      outgoing: c.caller_id === user.id,
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("calls").on("postgres_changes", { event: "*", schema: "public", table: "calls" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const callBack = async (other: any, type: "voice" | "video") => {
    if (!user || !other) return;
    const { data, error } = await createOrGetActiveCall({ callerId: user.id, calleeId: other.id, callType: type });
    if (error || !data) return toast.error(error?.message || "Failed");
    nav(`/call/${data.id}?role=caller`);
  };

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <h1 className="text-3xl font-bold mb-6">Calls</h1>

      <div className="space-y-2">
        {calls.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
              <Phone className="w-8 h-8" />
            </div>
            <p className="text-muted-foreground">No call history</p>
          </div>
        )}
        {calls.map((c) => {
          const Icon = c.status === "missed" ? PhoneMissed : c.outgoing ? PhoneOutgoing : PhoneIncoming;
          const color = c.status === "missed" ? "text-destructive" : "text-foreground";
          return (
            <div key={c.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
              <Avatar className="w-12 h-12">
                <AvatarImage src={c.other?.avatar_url || undefined} />
                <AvatarFallback>{c.other?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.other?.name || "Unknown"}</p>
                <p className={`text-xs flex items-center gap-1 ${color}`}>
                  <Icon className="w-3 h-3" />
                  {format(new Date(c.created_at), "MMM d, HH:mm")}
                </p>
              </div>
              <button onClick={() => callBack(c.other, c.call_type)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
                {c.call_type === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}

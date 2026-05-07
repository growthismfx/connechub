import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Plays a repeating ringtone using WebAudio (no asset needed)
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    ctxRef.current = ctx;

    const beep = () => {
      const t = ctx.currentTime;
      [0, 0.4].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t + offset);
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(0.25, t + offset + 0.02);
        gain.gain.linearRampToValueAtTime(0, t + offset + 0.32);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.35);
      });
    };

    beep();
    intervalRef.current = window.setInterval(beep, 1500);

    if ("vibrate" in navigator) {
      try { navigator.vibrate([500, 300, 500, 300, 500]); } catch {}
    }

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      try { ctx.close(); } catch {}
      ctxRef.current = null;
    };
  }, [active]);
}

export default function IncomingCallOverlay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [caller, setCaller] = useState<any>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useRingtone(!!incomingCall && !location.pathname.startsWith("/call/"));

  useEffect(() => {
    if (!user) return;

    const loadCaller = async (call: any) => {
      const { data } = await supabase.from("profiles").select("id, name, avatar_url, username").eq("id", call.caller_id).maybeSingle();
      setCaller(data);
    };

    const handleIncoming = async (call: any) => {
      if (!call?.id || seenRef.current.has(call.id)) return;
      if (!["calling", "ringing"].includes(call.status)) return;
      seenRef.current.add(call.id);
      setIncomingCall(call);
      await loadCaller(call);
    };

    supabase
      .from("calls")
      .select("*")
      .eq("callee_id", user.id)
      .in("status", ["calling", "ringing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data && handleIncoming(data));

    const channel = supabase
      .channel(`incoming-overlay-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        (payload) => handleIncoming(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        (payload) => {
          const call: any = payload.new;
          if (incomingCall?.id && call.id === incomingCall.id && ["ended", "rejected", "missed"].includes(call.status)) {
            setIncomingCall(null);
            setCaller(null);
          }
        }
      )
      .subscribe();

    // Listen for SW push messages (covers locked/closed → reopened scenarios)
    const onSwMessage = (e: MessageEvent) => {
      const p = e.data?.payload;
      if (e.data?.type === "push" && p?.kind === "call" && p?.callId) {
        supabase.from("calls").select("*").eq("id", p.callId).maybeSingle()
          .then(({ data }) => data && handleIncoming(data));
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    return () => {
      supabase.removeChannel(channel);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [user, incomingCall?.id]);

  if (!incomingCall || location.pathname.startsWith("/call/")) return null;

  const accept = async () => {
    await supabase.from("calls").update({ status: "ringing" }).eq("id", incomingCall.id);
    const id = incomingCall.id;
    setIncomingCall(null);
    navigate(`/call/${id}?role=callee`);
  };

  const decline = async () => {
    await supabase.from("calls").update({ status: "rejected", ended_at: new Date().toISOString() }).eq("id", incomingCall.id);
    setIncomingCall(null);
    setCaller(null);
  };

  const isVideo = incomingCall.call_type === "video";

  return (
    <div className="fixed inset-x-4 top-6 z-50 rounded-[28px] border border-border/60 bg-background/95 p-4 shadow-[var(--shadow-bubble)] backdrop-blur animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="w-14 h-14">
            <AvatarImage src={caller?.avatar_url || undefined} />
            <AvatarFallback>{caller?.name?.[0] || "C"}</AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/60 animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Incoming {isVideo ? "video" : "voice"} call</p>
          <h2 className="font-semibold truncate">{caller?.name || caller?.username || "Unknown"}</h2>
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
          {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="ghost" className="flex-1 rounded-full h-12" onClick={decline}>
          <PhoneOff className="w-4 h-4 mr-2" /> Decline
        </Button>
        <Button className="flex-1 rounded-full h-12 text-foreground border-0" style={{ background: "var(--gradient-cta)" }} onClick={accept}>
          <Phone className="w-4 h-4 mr-2" /> Receive
        </Button>
      </div>
    </div>
  );
}

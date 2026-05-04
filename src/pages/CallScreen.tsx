import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from "lucide-react";
import { toast } from "sonner";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function CallScreen() {
  const { callId } = useParams();
  const [params] = useSearchParams();
  const role = params.get("role") === "caller" ? "caller" : "callee";
  const { user } = useAuth();
  const nav = useNavigate();

  const [call, setCall] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [status, setStatus] = useState<"ringing" | "connecting" | "ongoing" | "ended">(role === "caller" ? "ringing" : "ringing");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const sentSignalIdsRef = useRef<Set<string>>(new Set());

  // Load call + other profile
  useEffect(() => {
    if (!callId || !user) return;
    (async () => {
      const { data } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
      if (!data) { toast.error("Call not found"); nav(-1); return; }
      setCall(data);
      const otherId = data.caller_id === user.id ? data.callee_id : data.caller_id;
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(prof);
    })();
  }, [callId, user]);

  // Subscribe to call status changes
  useEffect(() => {
    if (!callId) return;
    const ch = supabase.channel(`call-${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` }, (p) => {
        const c: any = p.new;
        setCall(c);
        if (c.status === "ended" || c.status === "rejected" || c.status === "missed") {
          cleanup();
          setStatus("ended");
          setTimeout(() => nav(-1), 1200);
        }
        if (c.status === "accepted" && status === "ringing") {
          setStatus("connecting");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [callId, status]);

  const sendSignal = async (kind: "offer" | "answer" | "ice", payload: any) => {
    if (!user || !call) return;
    const toUser = call.caller_id === user.id ? call.callee_id : call.caller_id;
    await supabase.from("call_signals").insert({
      call_id: call.id, from_user: user.id, to_user: toUser, kind, payload,
    });
  };

  const setupPeer = async (withVideo: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo ? { width: 640, height: 480, facingMode: "user" } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current && withVideo) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const [remote] = e.streams;
      if (withVideo && remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
      setStatus("ongoing");
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal("ice", e.candidate.toJSON());
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("ongoing");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall();
      }
    };
    return pc;
  };

  // Subscribe to incoming signals
  useEffect(() => {
    if (!callId || !user || !call) return;
    let cancelled = false;

    const handle = async (sig: any) => {
      if (sentSignalIdsRef.current.has(sig.id)) return;
      sentSignalIdsRef.current.add(sig.id);
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (sig.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          for (const c of pendingIceRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal("answer", { type: answer.type, sdp: answer.sdp });
        } else if (sig.kind === "answer") {
          if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            for (const c of pendingIceRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
            pendingIceRef.current = [];
          }
        } else if (sig.kind === "ice") {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
          else pendingIceRef.current.push(sig.payload);
        }
      } catch (err) {
        console.error("Signal handling error", err);
      }
    };

    // Fetch any signals already there
    (async () => {
      const { data } = await supabase.from("call_signals")
        .select("*").eq("call_id", callId).eq("to_user", user.id).order("created_at");
      if (cancelled) return;
      for (const s of data || []) await handle(s);
    })();

    const ch = supabase.channel(`signals-${callId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
        (p) => { if ((p.new as any).to_user === user.id) handle(p.new); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [callId, user, call]);

  // Start the call flow once we have call data
  const startedRef = useRef(false);
  useEffect(() => {
    if (!call || !user || startedRef.current) return;
    startedRef.current = true;
    const withVideo = call.call_type === "video";

    (async () => {
      try {
        if (role === "caller") {
          const pc = await setupPeer(withVideo);
          // Mark ringing
          await supabase.from("calls").update({ status: "ringing" }).eq("id", call.id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal("offer", { type: offer.type, sdp: offer.sdp });
        } else {
          // callee - prepare peer immediately (auto-accept for now to avoid extra UI step)
          await setupPeer(withVideo);
          await supabase.from("calls").update({ status: "accepted" }).eq("id", call.id);
        }
      } catch (e: any) {
        toast.error(e?.message || "Could not access camera/microphone");
        endCall();
      }
    })();
  }, [call, user, role]);

  const cleanup = () => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  };

  const endCall = async () => {
    cleanup();
    if (call) {
      await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", call.id);
    }
    setStatus("ended");
    setTimeout(() => nav(-1), 600);
  };

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleCam = () => {
    const next = !camOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCamOff(next);
  };

  const isVideo = call?.call_type === "video";

  return (
    <div className="min-h-screen bg-foreground text-background relative overflow-hidden">
      {isVideo && (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-6 right-6 w-32 h-44 rounded-2xl object-cover border-2 border-white/30 shadow-2xl bg-black z-10" />
        </>
      )}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Header / status */}
      <div className="relative z-20 pt-16 flex flex-col items-center text-white">
        {!isVideo && (
          <Avatar className="w-32 h-32 mb-4 border-4 border-white/20">
            <AvatarImage src={other?.avatar_url || undefined} />
            <AvatarFallback className="text-3xl bg-muted text-foreground">{other?.name?.[0]}</AvatarFallback>
          </Avatar>
        )}
        <h2 className="text-2xl font-bold drop-shadow-lg">{other?.name || "Calling..."}</h2>
        <p className="text-sm opacity-80 mt-1 drop-shadow">
          {status === "ringing" && (role === "caller" ? "Ringing..." : "Incoming call...")}
          {status === "connecting" && "Connecting..."}
          {status === "ongoing" && (isVideo ? "Video call · ongoing" : "Voice call · ongoing")}
          {status === "ended" && "Call ended"}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-10 left-0 right-0 z-20 flex items-center justify-center gap-5">
        <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur ${muted ? "bg-white text-foreground" : "bg-white/20 text-white"}`}>
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        {isVideo && (
          <button onClick={toggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur ${camOff ? "bg-white text-foreground" : "bg-white/20 text-white"}`}>
            {camOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
        <button onClick={endCall} className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-2xl">
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import MediaPermissionPrompt from "@/components/MediaPermissionPrompt";
import { requestMediaStream } from "@/lib/mediaPermissions";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

type CallUiState = "idle" | "calling" | "ringing" | "connected" | "ended";

const ALLOWED_TRANSITIONS: Record<CallUiState, CallUiState[]> = {
  idle: ["calling", "ringing", "connected", "ended"],
  calling: ["ringing", "connected", "ended"],
  ringing: ["connected", "ended"],
  connected: ["ended"],
  ended: [],
};

const ACTIVE_CALL_STATUSES = new Set(["calling", "ringing", "connected"]);

const isPeerOpen = (peer: RTCPeerConnection | null) => !!peer && peer.signalingState !== "closed";

export default function CallScreen() {
  const { callId } = useParams();
  const [params] = useSearchParams();
  const role = params.get("role") === "caller" ? "caller" : "callee";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [call, setCall] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [status, setStatus] = useState<CallUiState>(role === "caller" ? "calling" : "idle");
  const [hasAccepted, setHasAccepted] = useState(role === "caller");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const callRef = useRef<any>(null);
  const statusRef = useRef<CallUiState>(role === "caller" ? "calling" : "idle");
  const acceptedRef = useRef(role === "caller");
  const endedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const offerSentRef = useRef(false);
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const queuedOfferRef = useRef<any>(null);
  const callStartedAtRef = useRef<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const transitionTo = (next: CallUiState, force = false) => {
    const current = statusRef.current;
    if (current === next) return true;
    if (!force && !ALLOWED_TRANSITIONS[current].includes(next)) return false;
    statusRef.current = next;
    setStatus(next);
    return true;
  };

  const clearMediaTargets = () => {
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  const disposePeer = (stopLocal: boolean) => {
    const peer = pcRef.current;
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      if (peer.signalingState !== "closed") peer.close();
    }
    pcRef.current = null;
    pendingIceRef.current = [];
    remoteStreamRef.current = null;

    if (stopLocal && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    clearMediaTargets();
  };

  const updateCallRecord = async (patch: Record<string, any>) => {
    if (!callId) return null;
    const { data, error } = await supabase.from("calls").update(patch as any).eq("id", callId).select().maybeSingle();
    if (!error && data) {
      callRef.current = data;
      setCall(data);
    }
    return data;
  };

  const sendSignal = async (kind: "offer" | "answer" | "ice", payload: any) => {
    const currentCall = callRef.current;
    if (!user || !currentCall || endedRef.current || !ACTIVE_CALL_STATUSES.has(currentCall.status)) return;
    const toUser = currentCall.caller_id === user.id ? currentCall.callee_id : currentCall.caller_id;
    await supabase.from("call_signals").insert({
      call_id: currentCall.id,
      from_user: user.id,
      to_user: toUser,
      kind,
      payload,
    });
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const withVideo = callRef.current?.call_type === "video";
    const { stream, error } = await requestMediaStream(withVideo);
    if (!stream) {
      setPermissionError(error || "Permission denied");
      throw new Error(error || "Permission denied");
    }
    setPermissionError(null);
    localStreamRef.current = stream;
    if (withVideo && localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const attachLocalTracks = (peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      const alreadyAdded = peer.getSenders().some((sender) => sender.track?.id === track.id);
      if (!alreadyAdded && isPeerOpen(peer)) {
        peer.addTrack(track, stream);
      }
    });
  };

  const flushPendingIce = async (peer: RTCPeerConnection) => {
    if (!peer.remoteDescription) return;
    const queue = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const candidate of queue) {
      try {
        if (isPeerOpen(peer)) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch {
        pendingIceRef.current.push(candidate);
      }
    }
  };

  const createPeer = async (forceNew = false) => {
    if (!forceNew && isPeerOpen(pcRef.current)) return pcRef.current;

    disposePeer(false);

    const peer = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = peer;
    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;

    const stream = await ensureLocalStream();
    if (!isPeerOpen(peer)) return null;
    attachLocalTracks(peer, stream);

    peer.ontrack = (event) => {
      const remote = remoteStreamRef.current ?? new MediaStream();
      event.streams[0]?.getTracks().forEach((track) => {
        const exists = remote.getTracks().some((existing) => existing.id === track.id);
        if (!exists) remote.addTrack(track);
      });
      remoteStreamRef.current = remote;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && isPeerOpen(peer)) {
        void sendSignal("ice", event.candidate.toJSON());
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer !== pcRef.current || endedRef.current) return;

      if (peer.connectionState === "connected") {
        reconnectAttemptsRef.current = 0;
        if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
        transitionTo("connected");
        if (callRef.current?.status !== "connected") void updateCallRecord({ status: "connected" });
      }

      if (["disconnected", "failed"].includes(peer.connectionState)) {
        void attemptReconnect();
      }
    };

    return peer;
  };

  const applyOffer = async (offer: RTCSessionDescriptionInit) => {
    let peer = pcRef.current;
    if (!peer || !isPeerOpen(peer) || peer.signalingState !== "stable") {
      peer = await createPeer(true);
    }
    if (!peer || !isPeerOpen(peer)) return;
    if (peer.currentRemoteDescription?.sdp === offer.sdp) return;

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingIce(peer);

    const answer = await peer.createAnswer();
    if (!isPeerOpen(peer)) return;
    await peer.setLocalDescription(answer);
    await sendSignal("answer", { type: answer.type, sdp: answer.sdp });
  };

  const applyAnswer = async (answer: RTCSessionDescriptionInit) => {
    const peer = pcRef.current;
    if (!peer || !isPeerOpen(peer)) return;
    if (peer.currentRemoteDescription?.sdp === answer.sdp) return;
    if (peer.signalingState !== "have-local-offer") return;

    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingIce(peer);
  };

  const attemptReconnect = async () => {
    if (endedRef.current || reconnectingRef.current) return;
    if (reconnectAttemptsRef.current >= 1) {
      toast.error("Call disconnected");
      await endCall("ended", true);
      return;
    }

    reconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;

    try {
      const peer = await createPeer(true);
      if (role === "caller" && peer && isPeerOpen(peer) && peer.signalingState === "stable") {
        const offer = await peer.createOffer();
        if (!isPeerOpen(peer)) return;
        await peer.setLocalDescription(offer);
        await sendSignal("offer", { type: offer.type, sdp: offer.sdp });
      }
    } catch {
      await endCall("ended", true);
    } finally {
      reconnectingRef.current = false;
    }
  };

  const acceptIncoming = async () => {
    if (endedRef.current || acceptedRef.current) return;

    try {
      acceptedRef.current = true;
      setHasAccepted(true);
      transitionTo("ringing", true);
      await updateCallRecord({ status: "ringing" });
      await createPeer(false);

      if (queuedOfferRef.current) {
        const offer = queuedOfferRef.current;
        queuedOfferRef.current = null;
        await applyOffer(offer);
      }
    } catch (error: any) {
      // Permission UI handles re-asking; keep the call alive so the user can retry.
      if (permissionError) return;
      toast.error(error?.message || "Could not access microphone/camera");
      await endCall("rejected", true);
    }
  };

  const endCall = async (finalStatus: "ended" | "rejected" | "missed" = "ended", persist = true) => {
    if (endedRef.current) return;
    endedRef.current = true;
    transitionTo("ended", true);

    const duration = callStartedAtRef.current
      ? Math.max(0, Math.round((Date.now() - callStartedAtRef.current) / 1000))
      : 0;

    disposePeer(true);

    if (persist && callRef.current && ACTIVE_CALL_STATUSES.has(callRef.current.status)) {
      await updateCallRecord({
        status: finalStatus,
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      });
    }

    window.setTimeout(() => navigate("/calls"), 800);
  };

  const startOutgoingCall = async () => {
    if (!callRef.current || offerSentRef.current || endedRef.current) return;
    try {
      const peer = await createPeer(false);
      if (!peer || !isPeerOpen(peer) || peer.signalingState !== "stable") return;

      offerSentRef.current = true;
      transitionTo("calling", true);
      await updateCallRecord({ status: "calling" });

      const offer = await peer.createOffer();
      if (!isPeerOpen(peer)) return;
      await peer.setLocalDescription(offer);
      await sendSignal("offer", { type: offer.type, sdp: offer.sdp });
    } catch (error: any) {
      // Permission error UI will handle retry — don't tear the call down.
      if (permissionError) return;
      toast.error(error?.message || "Could not start the call");
      await endCall("ended", true);
    }
  };

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    if (!callId || !user) return;

    (async () => {
      const { data } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
      if (!data) {
        toast.error("Call not found");
        navigate("/calls");
        return;
      }

      callRef.current = data;
      setCall(data);

      const otherId = data.caller_id === user.id ? data.callee_id : data.caller_id;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(profile);

      if (role === "callee" && data.status !== "calling") {
        acceptedRef.current = true;
        setHasAccepted(true);
        transitionTo(data.status === "connected" ? "connected" : "ringing", true);
      }
    })();
  }, [callId, user, navigate, role]);

  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-room-${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` }, (payload) => {
        const nextCall: any = payload.new;
        callRef.current = nextCall;
        setCall(nextCall);

        if (nextCall.status === "ringing" && role === "caller") transitionTo("ringing");
        if (nextCall.status === "connected") transitionTo("connected");

        if (["ended", "rejected", "missed"].includes(nextCall.status)) {
          if (nextCall.status === "rejected" && role === "caller") toast.error("Call declined");
          void endCall(nextCall.status, false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, role]);

  useEffect(() => {
    if (!callId || !user || !call) return;
    let cancelled = false;

    const handleSignal = async (signal: any) => {
      if (cancelled || !signal?.id || processedSignalIdsRef.current.has(signal.id) || endedRef.current) return;
      if (signal.to_user !== user.id) return;
      processedSignalIdsRef.current.add(signal.id);

      try {
        if (signal.kind === "offer") {
          if (role === "callee" && !acceptedRef.current) {
            queuedOfferRef.current = signal.payload;
            return;
          }
          await applyOffer(signal.payload);
          return;
        }

        if (signal.kind === "answer") {
          await applyAnswer(signal.payload);
          return;
        }

        if (signal.kind === "ice") {
          const peer = pcRef.current;
          if (peer && isPeerOpen(peer) && peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(signal.payload));
          } else {
            pendingIceRef.current.push(signal.payload);
          }
        }
      } catch (error) {
        console.error("Signal handling error", error);
      }
    };

    supabase
      .from("call_signals")
      .select("*")
      .eq("call_id", callId)
      .eq("to_user", user.id)
      .order("created_at")
      .then(async ({ data }) => {
        if (cancelled) return;
        for (const signal of data || []) {
          await handleSignal(signal);
        }
      });

    const signalChannel = supabase
      .channel(`signals-${callId}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
        (payload) => {
          void handleSignal(payload.new);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(signalChannel);
    };
  }, [callId, user, call, role]);

  useEffect(() => {
    if (!call) return;
    if (["ended", "rejected", "missed"].includes(call.status)) return;

    if (role === "caller") {
      void startOutgoingCall();
      return;
    }

    if (role === "callee" && call.status === "ringing" && !acceptedRef.current) {
      void acceptIncoming();
    }
  }, [call, role]);

  useEffect(() => {
    return () => {
      disposePeer(true);
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !camOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCamOff(next);
  };

  const isVideo = call?.call_type === "video";
  const showReceiveActions = role === "callee" && !hasAccepted && status !== "ended";

  const statusLabel =
    status === "ended"
      ? "Call ended"
      : status === "connected"
        ? isVideo
          ? "Video call live"
          : "Voice call live"
        : role === "caller"
          ? status === "ringing"
            ? "Ringing…"
            : "Calling…"
          : hasAccepted
            ? "Connecting…"
            : `Incoming ${isVideo ? "video" : "voice"} call`;

  return (
    <div className="min-h-screen bg-foreground text-background relative overflow-hidden">
      {isVideo && (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-6 right-6 w-32 h-44 rounded-2xl object-cover border border-white/20 shadow-2xl bg-black z-10" />
        </>
      )}

      <audio ref={remoteAudioRef} autoPlay />

      <div className="relative z-20 pt-16 px-6 flex flex-col items-center text-white text-center">
        {!isVideo && (
          <Avatar className="w-32 h-32 mb-4 border-4 border-white/20">
            <AvatarImage src={other?.avatar_url || undefined} />
            <AvatarFallback className="text-3xl bg-muted text-foreground">{other?.name?.[0]}</AvatarFallback>
          </Avatar>
        )}
        <h1 className="text-3xl font-bold">{other?.name || "Call"}</h1>
        <p className="text-sm opacity-80 mt-2">{statusLabel}</p>
      </div>

      {showReceiveActions ? (
        <div className="absolute bottom-10 left-0 right-0 z-20 px-6">
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Button variant="ghost" className="rounded-full h-14 bg-white/10 text-white hover:bg-white/20" onClick={() => endCall("rejected", true)}>
              <PhoneOff className="w-5 h-5 mr-2" /> Decline
            </Button>
            <Button className="rounded-full h-14 text-foreground border-0" style={{ background: "var(--gradient-cta)" }} onClick={acceptIncoming}>
              <Phone className="w-5 h-5 mr-2" /> Receive
            </Button>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-10 left-0 right-0 z-20 flex items-center justify-center gap-5 px-6">
          <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur ${muted ? "bg-white text-foreground" : "bg-white/20 text-white"}`}>
            {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          {isVideo && (
            <button onClick={toggleCamera} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur ${camOff ? "bg-white text-foreground" : "bg-white/20 text-white"}`}>
              {camOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}
          <button onClick={() => endCall("ended", true)} className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-2xl">
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      )}

      {permissionError && (
        <MediaPermissionPrompt
          needVideo={isVideo}
          errorMessage={permissionError}
          onCancel={() => endCall("ended", true)}
          onRetry={async () => {
            setPermissionError(null);
            try {
              await ensureLocalStream();
              if (role === "caller" && !offerSentRef.current) {
                offerSentRef.current = false;
                await startOutgoingCall();
              } else if (role === "callee") {
                await acceptIncoming();
              }
            } catch {
              /* prompt will reopen via setPermissionError inside ensureLocalStream */
            }
          }}
        />
      )}
    </div>
  );
}

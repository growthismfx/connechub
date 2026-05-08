import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requestMediaStream } from "@/lib/mediaPermissions";
import { toast } from "sonner";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export type CallUiState = "idle" | "calling" | "ringing" | "connected" | "ended";
export type CallRole = "caller" | "callee";

const ALLOWED: Record<CallUiState, CallUiState[]> = {
  idle: ["calling", "ringing", "connected", "ended"],
  calling: ["ringing", "connected", "ended"],
  ringing: ["connected", "ended"],
  connected: ["ended"],
  ended: [],
};

const ACTIVE_STATUSES = new Set(["calling", "ringing", "connected"]);
const isOpen = (p: RTCPeerConnection | null) => !!p && p.signalingState !== "closed";

type ActiveCallApi = {
  call: any | null;
  other: any | null;
  status: CallUiState;
  hasAccepted: boolean;
  muted: boolean;
  camOff: boolean;
  facing: "user" | "environment";
  permissionError: string | null;
  callDurationStart: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (callId: string, role: CallRole) => void;
  acceptIncoming: () => Promise<void>;
  endCall: (final?: "ended" | "rejected" | "missed") => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => Promise<void>;
  retryPermission: () => Promise<void>;
};

const Ctx = createContext<ActiveCallApi | null>(null);
export const useActiveCall = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useActiveCall must be used within ActiveCallProvider");
  return c;
};

export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [call, setCall] = useState<any | null>(null);
  const [other, setOther] = useState<any | null>(null);
  const [status, setStatus] = useState<CallUiState>("idle");
  const [hasAccepted, setHasAccepted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [callDurationStart, setCallDurationStart] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callRef = useRef<any | null>(null);
  const roleRef = useRef<CallRole>("caller");
  const statusRef = useRef<CallUiState>("idle");
  const acceptedRef = useRef(false);
  const endedRef = useRef(false);
  const offerSentRef = useRef(false);
  const reconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const queuedOfferRef = useRef<any>(null);
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<any>(null);

  const transitionTo = (next: CallUiState, force = false) => {
    const cur = statusRef.current;
    if (cur === next) return true;
    if (!force && !ALLOWED[cur].includes(next)) return false;
    statusRef.current = next;
    setStatus(next);
    return true;
  };

  const updateCallRecord = async (patch: Record<string, any>) => {
    const c = callRef.current;
    if (!c) return null;
    const { data } = await supabase.from("calls").update(patch as any).eq("id", c.id).select().maybeSingle();
    if (data) {
      callRef.current = data;
      setCall(data);
    }
    return data;
  };

  const sendSignal = async (kind: "offer" | "answer" | "ice", payload: any) => {
    const c = callRef.current;
    if (!user || !c || endedRef.current || !ACTIVE_STATUSES.has(c.status)) return;
    const toUser = c.caller_id === user.id ? c.callee_id : c.caller_id;
    await supabase.from("call_signals").insert({ call_id: c.id, from_user: user.id, to_user: toUser, kind, payload });
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
    setLocalStream(stream);
    return stream;
  };

  const attachLocalTracks = (peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      const exists = peer.getSenders().some((s) => s.track?.id === track.id);
      if (!exists && isOpen(peer)) peer.addTrack(track, stream);
    });
  };

  const flushPendingIce = async (peer: RTCPeerConnection) => {
    if (!peer.remoteDescription) return;
    const queue = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const cand of queue) {
      try {
        if (isOpen(peer)) await peer.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        pendingIceRef.current.push(cand);
      }
    }
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
    setRemoteStream(null);

    if (stopLocal && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  const createPeer = async (forceNew = false): Promise<RTCPeerConnection | null> => {
    if (!forceNew && isOpen(pcRef.current)) return pcRef.current;
    disposePeer(false);

    const peer = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = peer;

    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    const stream = await ensureLocalStream();
    if (!isOpen(peer)) return null;
    attachLocalTracks(peer, stream);

    peer.ontrack = (e) => {
      const r = remoteStreamRef.current ?? new MediaStream();
      e.streams[0]?.getTracks().forEach((t) => {
        if (!r.getTracks().some((x) => x.id === t.id)) r.addTrack(t);
      });
      remoteStreamRef.current = r;
      setRemoteStream(r);
    };

    peer.onicecandidate = (e) => {
      if (e.candidate && isOpen(peer)) void sendSignal("ice", e.candidate.toJSON());
    };

    peer.onconnectionstatechange = () => {
      if (peer !== pcRef.current || endedRef.current) return;
      if (peer.connectionState === "connected") {
        reconnectAttemptsRef.current = 0;
        if (!callDurationStart) setCallDurationStart(Date.now());
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
    if (!peer || !isOpen(peer) || peer.signalingState !== "stable") {
      peer = await createPeer(true);
    }
    if (!peer || !isOpen(peer)) return;
    if (peer.currentRemoteDescription?.sdp === offer.sdp) return;
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingIce(peer);
    const answer = await peer.createAnswer();
    if (!isOpen(peer)) return;
    await peer.setLocalDescription(answer);
    await sendSignal("answer", { type: answer.type, sdp: answer.sdp });
  };

  const applyAnswer = async (answer: RTCSessionDescriptionInit) => {
    const peer = pcRef.current;
    if (!peer || !isOpen(peer)) return;
    if (peer.currentRemoteDescription?.sdp === answer.sdp) return;
    if (peer.signalingState !== "have-local-offer") return;
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingIce(peer);
  };

  const attemptReconnect = async () => {
    if (endedRef.current || reconnectingRef.current) return;
    if (reconnectAttemptsRef.current >= 1) {
      toast.error("Call disconnected");
      await endCall("ended");
      return;
    }
    reconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;
    try {
      const peer = await createPeer(true);
      if (roleRef.current === "caller" && peer && isOpen(peer) && peer.signalingState === "stable") {
        const offer = await peer.createOffer();
        if (!isOpen(peer)) return;
        await peer.setLocalDescription(offer);
        await sendSignal("offer", { type: offer.type, sdp: offer.sdp });
      }
    } catch {
      await endCall("ended");
    } finally {
      reconnectingRef.current = false;
    }
  };

  const startOutgoingCall = async () => {
    if (!callRef.current || offerSentRef.current || endedRef.current) return;
    try {
      const peer = await createPeer(false);
      if (!peer || !isOpen(peer) || peer.signalingState !== "stable") return;
      offerSentRef.current = true;
      transitionTo("calling", true);
      await updateCallRecord({ status: "calling" });
      const offer = await peer.createOffer();
      if (!isOpen(peer)) return;
      await peer.setLocalDescription(offer);
      await sendSignal("offer", { type: offer.type, sdp: offer.sdp });
    } catch (e: any) {
      if (permissionError) {
        offerSentRef.current = false;
        return;
      }
      toast.error(e?.message || "Could not start the call");
      await endCall("ended");
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
    } catch (e: any) {
      if (permissionError) {
        acceptedRef.current = false;
        setHasAccepted(false);
        return;
      }
      toast.error(e?.message || "Could not access mic/camera");
      await endCall("rejected");
    }
  };

  const endCall = async (finalStatus: "ended" | "rejected" | "missed" = "ended") => {
    if (endedRef.current) return;
    endedRef.current = true;
    transitionTo("ended", true);

    const duration = callDurationStart ? Math.max(0, Math.round((Date.now() - callDurationStart) / 1000)) : 0;
    disposePeer(true);

    if (callRef.current && ACTIVE_STATUSES.has(callRef.current.status)) {
      await updateCallRecord({
        status: finalStatus,
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      });
    }

    // release wake lock
    try { await wakeLockRef.current?.release?.(); } catch {}
    wakeLockRef.current = null;

    // Reset state shortly after, so UI can animate out
    window.setTimeout(() => {
      callRef.current = null;
      roleRef.current = "caller";
      acceptedRef.current = false;
      endedRef.current = false;
      offerSentRef.current = false;
      reconnectAttemptsRef.current = 0;
      processedSignalIdsRef.current = new Set();
      queuedOfferRef.current = null;
      setCall(null);
      setOther(null);
      setHasAccepted(false);
      setMuted(false);
      setCamOff(false);
      setFacing("user");
      setCallDurationStart(null);
      setPermissionError(null);
      transitionTo("idle", true);
    }, 600);
  };

  const startCall = useCallback((callId: string, role: CallRole) => {
    if (callRef.current && callRef.current.id === callId) return; // already active
    if (callRef.current) return; // another call in progress
    roleRef.current = role;
    acceptedRef.current = role === "caller";
    setHasAccepted(role === "caller");
    transitionTo(role === "caller" ? "calling" : "idle", true);

    (async () => {
      const { data } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
      if (!data) {
        toast.error("Call not found");
        return;
      }
      callRef.current = data;
      setCall(data);

      const otherId = data.caller_id === user!.id ? data.callee_id : data.caller_id;
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(prof);

      if (role === "callee" && data.status !== "calling") {
        acceptedRef.current = true;
        setHasAccepted(true);
        transitionTo(data.status === "connected" ? "connected" : "ringing", true);
      }
    })();
  }, [user]);

  // Subscribe to call & signals once a call is active
  useEffect(() => {
    if (!call?.id) return;
    const ch = supabase.channel(`call-room-${call.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${call.id}` }, (p) => {
        const next: any = p.new;
        callRef.current = next;
        setCall(next);
        if (next.status === "ringing" && roleRef.current === "caller") transitionTo("ringing");
        if (next.status === "connected") transitionTo("connected");
        if (["ended", "rejected", "missed"].includes(next.status)) {
          if (next.status === "rejected" && roleRef.current === "caller") toast.error("Call declined");
          void endCall(next.status);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [call?.id]);

  useEffect(() => {
    if (!call?.id || !user) return;

    const handleSignal = async (signal: any) => {
      if (!signal?.id || processedSignalIdsRef.current.has(signal.id) || endedRef.current) return;
      if (signal.to_user !== user.id) return;
      processedSignalIdsRef.current.add(signal.id);
      try {
        if (signal.kind === "offer") {
          if (roleRef.current === "callee" && !acceptedRef.current) {
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
          if (peer && isOpen(peer) && peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(signal.payload));
          } else {
            pendingIceRef.current.push(signal.payload);
          }
        }
      } catch (e) { console.error("signal", e); }
    };

    supabase.from("call_signals").select("*").eq("call_id", call.id).eq("to_user", user.id).order("created_at")
      .then(async ({ data }) => { for (const s of data || []) await handleSignal(s); });

    const ch = supabase.channel(`signals-${call.id}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${call.id}` },
        (p) => { void handleSignal(p.new); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [call?.id, user]);

  // Drive caller/callee setup once we have call + role
  useEffect(() => {
    if (!call) return;
    if (["ended", "rejected", "missed"].includes(call.status)) return;
    if (roleRef.current === "caller") {
      void startOutgoingCall();
      return;
    }
    if (roleRef.current === "callee" && call.status === "ringing" && !acceptedRef.current) {
      void acceptIncoming();
    }
  }, [call?.id, call?.status]);

  // Acquire wake lock while call is active to prevent device sleep
  useEffect(() => {
    if (status !== "connected") return;
    (async () => {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock?.request?.("screen");
      } catch {}
    })();
    const onVis = async () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        try { wakeLockRef.current = await (navigator as any).wakeLock?.request?.("screen"); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status]);

  // Auto-mark as "missed" if not answered within 40s
  useEffect(() => {
    if (!call?.id) return;
    if (!["calling", "ringing"].includes(status)) return;
    const t = window.setTimeout(() => {
      if (endedRef.current) return;
      const c = callRef.current;
      if (!c || !ACTIVE_STATUSES.has(c.status)) return;
      // Caller side: callee never picked up → missed
      // Callee side: never accepted → missed
      void endCall("missed");
    }, 40000);
    return () => window.clearTimeout(t);
  }, [call?.id, status]);

  // Warn user if they try to close the tab during an active call
  useEffect(() => {
    if (!call || status === "ended" || status === "idle") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Leaving will end your call.";
    };
    window.addEventListener("beforeunload", handler);
    // On page actual unload, end the call cleanly
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) {
        // Best-effort: mark call as ended
        const c = callRef.current;
        if (c && ACTIVE_STATUSES.has(c.status)) {
          const blob = new Blob([JSON.stringify({})], { type: "application/json" });
          // Just fire & forget update (won't always run)
          void supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", c.id);
        }
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [call?.id, status]);


  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !camOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCamOff(next);
  };

  const switchCamera = async () => {
    if (callRef.current?.call_type !== "video") return;
    const peer = pcRef.current;
    const newFacing = facing === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      // Replace on peer
      const sender = peer?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      // Replace on local stream
      const ls = localStreamRef.current;
      if (ls) {
        ls.getVideoTracks().forEach((t) => { t.stop(); ls.removeTrack(t); });
        ls.addTrack(newTrack);
        setLocalStream(new MediaStream(ls.getTracks()));
      }
      setFacing(newFacing);
    } catch (e) {
      toast.error("Could not switch camera");
    }
  };

  const retryPermission = async () => {
    setPermissionError(null);
    try {
      await ensureLocalStream();
      if (roleRef.current === "caller" && !offerSentRef.current) {
        await startOutgoingCall();
      } else if (roleRef.current === "callee") {
        await acceptIncoming();
      }
    } catch {}
  };

  const value = useMemo<ActiveCallApi>(() => ({
    call, other, status, hasAccepted, muted, camOff, facing, permissionError,
    callDurationStart, localStream, remoteStream,
    startCall, acceptIncoming, endCall, toggleMute, toggleCamera, switchCamera, retryPermission,
  }), [call, other, status, hasAccepted, muted, camOff, facing, permissionError, callDurationStart, localStream, remoteStream, startCall]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

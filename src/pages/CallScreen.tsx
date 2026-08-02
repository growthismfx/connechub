import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useActiveCall } from "@/contexts/ActiveCallContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronDown, Mic, MicOff, Phone, PhoneOff, Video, VideoOff, SwitchCamera } from "lucide-react";
import MediaPermissionPrompt from "@/components/MediaPermissionPrompt";

export default function CallScreen() {
  const { callId } = useParams();
  const [params] = useSearchParams();
  const role = params.get("role") === "caller" ? "caller" : "callee";
  const nav = useNavigate();

  const {
    call, other, status, hasAccepted, muted, camOff, permissionError, localStream, remoteStream,
    startCall, acceptIncoming, endCall, toggleMute, toggleCamera, switchCamera, retryPermission,
  } = useActiveCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Boot/attach the call into the global provider
  useEffect(() => {
    if (!callId) return;
    startCall(callId, role);
  }, [callId, role, startCall]);

  // Callback refs: video elements mount only after the call type is known,
  // so attach the stream the moment the element appears (and on stream change).
  const attachLocal = (el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && el.srcObject !== localStream) el.srcObject = localStream;
  };
  const attachRemote = (el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream;
  };
  const attachRemoteAudio = (el: HTMLAudioElement | null) => {
    remoteAudioRef.current = el;
    if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream;
  };

  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play?.().catch(() => {});
    }
  }, [localStream, call?.call_type]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play?.().catch(() => {});
    }
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play?.().catch(() => {});
    }
  }, [remoteStream, status, call?.call_type]);


  // When call ends, leave the screen
  useEffect(() => {
    if (status === "ended") {
      const t = window.setTimeout(() => nav("/calls"), 600);
      return () => window.clearTimeout(t);
    }
  }, [status, nav]);

  const isVideo = call?.call_type === "video";
  const showReceiveActions = role === "callee" && !hasAccepted && status !== "ended";

  const statusLabel =
    status === "ended"
      ? "Call ended"
      : status === "connected"
        ? isVideo ? "Video call live" : "Voice call live"
        : role === "caller"
          ? status === "ringing" ? "Ringing…" : "Calling…"
          : hasAccepted ? "Connecting…" : `Incoming ${isVideo ? "video" : "voice"} call`;

  // Minimize: just go back — call keeps running thanks to the provider
  const minimize = () => nav(-1);

  return (
    <div className="min-h-screen bg-foreground text-background relative overflow-hidden">
      {isVideo && (
        <>
          <video ref={attachRemote} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
          <video ref={attachLocal} autoPlay playsInline muted className="absolute top-6 right-6 w-32 h-44 rounded-2xl object-cover border border-white/20 shadow-2xl bg-black z-10" />
        </>
      )}

      <audio ref={attachRemoteAudio} autoPlay />


      {/* Minimize bar */}
      <button
        onClick={minimize}
        className="absolute top-4 left-4 z-30 flex items-center gap-1 text-white/80 text-sm bg-white/10 backdrop-blur rounded-full px-3 py-1.5"
      >
        <ChevronDown className="w-4 h-4" /> Minimize
      </button>

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
            <Button variant="ghost" className="rounded-full h-14 bg-white/10 text-white hover:bg-white/20" onClick={() => endCall("rejected")}>
              <PhoneOff className="w-5 h-5 mr-2" /> Decline
            </Button>
            <Button className="rounded-full h-14 text-foreground border-0" style={{ background: "var(--gradient-cta)" }} onClick={() => acceptIncoming()}>
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
          {isVideo && (
            <button onClick={() => switchCamera()} className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur bg-white/20 text-white">
              <SwitchCamera className="w-6 h-6" />
            </button>
          )}
          <button onClick={() => endCall("ended")} className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-2xl">
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      )}

      {permissionError && (
        <MediaPermissionPrompt
          needVideo={!!isVideo}
          errorMessage={permissionError}
          onCancel={() => endCall("ended")}
          onRetry={() => retryPermission()}
        />
      )}
    </div>
  );
}

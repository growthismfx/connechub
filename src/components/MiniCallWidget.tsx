import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useActiveCall } from "@/contexts/ActiveCallContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Maximize2, SwitchCamera } from "lucide-react";

function formatDuration(start: number | null) {
  if (!start) return "Connecting…";
  const sec = Math.floor((Date.now() - start) / 1000);
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MiniCallWidget() {
  const { call, other, status, muted, camOff, callDurationStart, toggleMute, toggleCamera, switchCamera, endCall } = useActiveCall();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== "connected") return;
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [status]);

  if (!call || status === "idle" || status === "ended") return null;
  if (loc.pathname.startsWith("/call/")) return null;

  const isVideo = call.call_type === "video";
  const label =
    status === "connected"
      ? formatDuration(callDurationStart)
      : status === "ringing" ? "Ringing…" : "Calling…";

  const expand = () => nav(`/call/${call.id}?role=${call.caller_id ? "caller" : "callee"}`);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-foreground/95 text-background pl-1 pr-4 py-1 shadow-2xl backdrop-blur animate-fade-in"
      >
        <div className="relative">
          <Avatar className="w-9 h-9 border-2 border-background/20">
            <AvatarImage src={other?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-muted text-foreground">{other?.name?.[0] || "?"}</AvatarFallback>
          </Avatar>
          {status === "connected" && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-foreground" />
          )}
          {status !== "connected" && (
            <span className="absolute inset-0 rounded-full ring-2 ring-primary/60 animate-ping" />
          )}
        </div>
        <div className="text-left">
          <p className="text-xs font-medium leading-tight truncate max-w-[140px]">{other?.name || "Call"}</p>
          <p className="text-[10px] opacity-70 leading-tight">{label}</p>
        </div>
        {isVideo ? <Video className="w-4 h-4 opacity-80" /> : <Phone className="w-4 h-4 opacity-80" />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-background pb-8">
          <div className="flex flex-col items-center pt-2">
            <Avatar className="w-20 h-20 mb-3 border-4 border-border">
              <AvatarImage src={other?.avatar_url || undefined} />
              <AvatarFallback className="text-xl">{other?.name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-semibold">{other?.name || "Call"}</h3>
            <p className="text-sm text-muted-foreground">{label}</p>

            <div className="grid grid-cols-4 gap-3 mt-6 w-full max-w-sm">
              <button onClick={toggleMute} className={`flex flex-col items-center gap-1 py-3 rounded-2xl ${muted ? "bg-foreground text-background" : "bg-muted"}`}>
                {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span className="text-[10px]">{muted ? "Unmute" : "Mute"}</span>
              </button>
              {isVideo ? (
                <button onClick={toggleCamera} className={`flex flex-col items-center gap-1 py-3 rounded-2xl ${camOff ? "bg-foreground text-background" : "bg-muted"}`}>
                  {camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  <span className="text-[10px]">{camOff ? "Open" : "Camera"}</span>
                </button>
              ) : (
                <div />
              )}
              {isVideo ? (
                <button onClick={switchCamera} className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-muted">
                  <SwitchCamera className="w-5 h-5" />
                  <span className="text-[10px]">Flip</span>
                </button>
              ) : (
                <div />
              )}
              <button onClick={() => { setOpen(false); expand(); }} className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-muted">
                <Maximize2 className="w-5 h-5" />
                <span className="text-[10px]">Expand</span>
              </button>
            </div>

            <Button
              onClick={() => { void endCall("ended"); setOpen(false); }}
              className="mt-6 w-full max-w-sm rounded-full h-12 bg-destructive text-white hover:bg-destructive/90"
            >
              <PhoneOff className="w-4 h-4 mr-2" /> End call
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

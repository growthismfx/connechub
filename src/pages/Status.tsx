import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Eye, Image as ImageIcon, Video as VideoIcon, Type, X, ChevronLeft, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STORY_DURATION_MS = 5000;

export default function Status() {
  const { user, profile } = useAuth();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [bg, setBg] = useState("var(--gradient-cta)");
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // Viewer state — list of statuses belonging to one user
  const [viewerList, setViewerList] = useState<any[]>([]);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  const advanceTimer = useRef<number | null>(null);

  const load = async () => {
    const { data: rows, error } = await supabase
      .from("statuses")
      .select("id, content, media_url, media_type, background, created_at, user_id")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    if (error) { console.error(error); setStatuses([]); return; }
    const list = rows || [];
    const ids = Array.from(new Set(list.map((s: any) => s.user_id)));
    const profMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, username")
        .in("id", ids);
      (profs || []).forEach((p: any) => { profMap[p.id] = p; });
    }
    setStatuses(list.map((s: any) => ({ ...s, profiles: profMap[s.user_id] || null })));
  };

  const loadSeen = async () => {
    if (!user) return;
    const { data } = await supabase.from("status_views").select("status_id").eq("viewer_id", user.id);
    setSeenIds(new Set((data || []).map((r: any) => r.status_id)));
  };

  useEffect(() => {
    load(); loadSeen();
    const ch = supabase
      .channel("statuses-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_views" }, loadSeen)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Group statuses per user
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    statuses.forEach((s) => {
      if (!map.has(s.user_id)) map.set(s.user_id, []);
      map.get(s.user_id)!.push(s);
    });
    return map;
  }, [statuses]);

  const myStatuses = grouped.get(user?.id || "") || [];
  const otherEntries = Array.from(grouped.entries()).filter(([uid]) => uid !== user?.id);

  const allUnseenForUser = (list: any[]) => list.some((s) => !seenIds.has(s.id));

  const post = async () => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("statuses").insert({ user_id: user.id, content: text.trim(), background: bg });
    if (error) return toast.error(error.message);
    setText(""); setOpen(false); toast.success("Status posted");
  };

  const uploadMedia = async (file: File, kind: "image" | "video") => {
    if (!user) return;
    setUploading(true);
    try {
      const path = `${user.id}/status-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file);
      if (upErr) throw upErr;
      const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 30);
      const { error } = await supabase.from("statuses").insert({
        user_id: user.id, media_url: data?.signedUrl, media_type: kind, content: null,
      });
      if (error) throw error;
      toast.success(`${kind === "image" ? "Photo" : "Video"} status posted`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploading(false); }
  };

  const openViewer = (list: any[]) => {
    // jump to first unseen, or 0
    const startIdx = Math.max(0, list.findIndex((s) => !seenIds.has(s.id)));
    setViewerList(list);
    setViewerIdx(startIdx === -1 ? 0 : startIdx);
  };
  const closeViewer = () => { setViewerList([]); setViewerIdx(0); setViewers([]); };

  // Mark viewed + auto-advance
  useEffect(() => {
    if (!viewerList.length || !user) return;
    const current = viewerList[viewerIdx];
    if (!current) return;

    if (current.user_id !== user.id && !seenIds.has(current.id)) {
      supabase.from("status_views").insert({ status_id: current.id, viewer_id: user.id }).then(() => {
        setSeenIds((prev) => new Set([...prev, current.id]));
      });
    }
    if (current.user_id === user.id) {
      supabase.rpc("get_status_views", { _status_id: current.id }).then(({ data }) => setViewers(data || []));
    } else {
      setViewers([]);
    }

    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    // Videos: let them play naturally; advance via onEnded. Other types: timed.
    if (current.media_type !== "video") {
      advanceTimer.current = window.setTimeout(() => goNext(), STORY_DURATION_MS);
    }
    return () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIdx, viewerList]);

  const goNext = () => {
    setViewerIdx((i) => {
      if (i + 1 >= viewerList.length) { closeViewer(); return 0; }
      return i + 1;
    });
  };
  const goPrev = () => setViewerIdx((i) => Math.max(0, i - 1));

  const gradients = ["var(--gradient-cta)", "var(--gradient-bubble)", "var(--gradient-card)", "linear-gradient(135deg,#a8edea,#fed6e3)", "linear-gradient(135deg,#667eea,#764ba2)"];

  const current = viewerList[viewerIdx];

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Status</h1>
        <button onClick={() => setOpen(true)} className="w-11 h-11 rounded-full flex items-center justify-center shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* My status */}
      <button onClick={() => myStatuses.length ? openViewer(myStatuses) : setOpen(true)} className="w-full flex items-center gap-3 p-3 bg-white themed-btn shadow-[var(--shadow-soft)] mb-6">
        <div className="relative">
          <div className={myStatuses.length ? "status-ring-mine" : ""}>
            <Avatar className="w-14 h-14 ring-2 ring-background">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.name?.[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow" style={{ background: "var(--gradient-cta)" }}>
            <Plus className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold">My status</p>
          <p className="text-xs text-muted-foreground">{myStatuses.length ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""}` : "Tap to add status"}</p>
        </div>
      </button>

      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-2">Recent updates</p>
      <div className="space-y-2">
        {otherEntries.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No recent updates</p>}
        {otherEntries.map(([uid, list]) => {
          const unseen = allUnseenForUser(list);
          const latest = list[list.length - 1];
          return (
            <button key={uid} onClick={() => openViewer(list)} className="w-full flex items-center gap-3 p-3 themed-btn hover:bg-white/60">
              <div className={unseen ? "status-ring-unseen" : "status-ring-seen"}>
                <Avatar className="w-12 h-12 ring-2 ring-background">
                  <AvatarImage src={latest.profiles?.avatar_url || undefined} />
                  <AvatarFallback>{latest.profiles?.name?.[0]}</AvatarFallback>
                </Avatar>
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold">{latest.profiles?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {list.length} update{list.length > 1 ? "s" : ""} · {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Composer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-0 max-w-md themed-btn">
          <DialogHeader><DialogTitle>New status</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <button onClick={() => photoRef.current?.click()} disabled={uploading} className="flex flex-col items-center gap-1 p-3 themed-btn bg-muted hover:bg-muted/80">
              <ImageIcon className="w-5 h-5" /><span className="text-xs">Photo</span>
            </button>
            <button onClick={() => videoRef.current?.click()} disabled={uploading} className="flex flex-col items-center gap-1 p-3 themed-btn bg-muted hover:bg-muted/80">
              <VideoIcon className="w-5 h-5" /><span className="text-xs">Video</span>
            </button>
            <div className="flex flex-col items-center gap-1 p-3 themed-btn" style={{ background: "var(--gradient-card)" }}>
              <Type className="w-5 h-5" /><span className="text-xs font-semibold">Text</span>
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0], "image")} />
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0], "video")} />
          <div className="themed-btn p-6 min-h-[160px] flex items-center justify-center" style={{ background: bg }}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind?" className="bg-transparent border-0 text-center text-lg font-semibold resize-none focus-visible:ring-0" />
          </div>
          <div className="flex gap-2 justify-center">
            {gradients.map((g) => (
              <button key={g} onClick={() => setBg(g)} className={`w-8 h-8 rounded-full ${bg === g ? "ring-2 ring-foreground" : ""}`} style={{ background: g }} />
            ))}
          </div>
          <Button onClick={post} disabled={uploading || !text.trim()} className="themed-btn h-12 text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>
            {uploading ? "Uploading…" : "Post text status"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* WhatsApp-style slide viewer */}
      {current && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-20">
            {viewerList.map((s, i) => (
              <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className={i < viewerIdx ? "h-full bg-white" : i === viewerIdx ? "story-bar-fill" : ""}
                  style={i === viewerIdx ? { animationDuration: `${current.media_type === "video" ? 15000 : STORY_DURATION_MS}ms` } : { width: i < viewerIdx ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-20">
            <div className="flex items-center gap-2">
              <Avatar className="w-9 h-9 ring-2 ring-white">
                <AvatarImage src={current.profiles?.avatar_url || undefined} />
                <AvatarFallback>{current.profiles?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-semibold text-sm">{current.profiles?.name || "You"}</p>
                <p className="text-white/70 text-xs">{formatDistanceToNow(new Date(current.created_at), { addSuffix: true })}</p>
              </div>
            </div>
            <button onClick={closeViewer} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tap zones */}
          <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-start pl-2 text-white/0 hover:text-white/40">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-end pr-2 text-white/0 hover:text-white/40">
            <ChevronRight className="w-7 h-7" />
          </button>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center" style={{ background: current.background || "var(--gradient-cta)" }}>
            {current.media_type === "image" && current.media_url ? (
              <img src={current.media_url} alt="" className="max-h-full max-w-full object-contain" />
            ) : current.media_type === "video" && current.media_url ? (
              <video src={current.media_url} autoPlay playsInline controls={false} onEnded={goNext} className="max-h-full max-w-full" />
            ) : (
              <p className="text-2xl font-semibold leading-snug text-center px-8 text-foreground">{current.content}</p>
            )}
          </div>

          {/* Viewers (own only) */}
          {current.user_id === user?.id && (
            <div className="bg-black/70 backdrop-blur p-4 max-h-48 overflow-y-auto">
              <p className="text-xs uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Viewed by {viewers.length}
              </p>
              {viewers.length === 0 && <p className="text-sm text-white/60">No views yet</p>}
              <div className="space-y-2">
                {viewers.map((v: any) => (
                  <div key={v.viewer_id} className="flex items-center gap-2">
                    <Avatar className="w-8 h-8"><AvatarImage src={v.avatar_url || undefined} /><AvatarFallback>{v.name?.[0]}</AvatarFallback></Avatar>
                    <p className="text-sm flex-1 truncate text-white">{v.name}</p>
                    <p className="text-xs text-white/60">{formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

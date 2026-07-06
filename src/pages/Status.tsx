import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Eye, Image as ImageIcon, Video as VideoIcon, Type, X,
  ChevronLeft, ChevronRight, BarChart3, HelpCircle, Brain,
  Timer, MapPin, Link2, Music2, AtSign, Repeat2, Heart, Send,
  Sliders, Globe, Users, UserCheck, Shield,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import MusicPicker from "@/components/MusicPicker";

const STORY_DURATION_MS = 5000;

const STORY_TYPES = [
  { id: "photo", icon: ImageIcon, label: "Photo" },
  { id: "video", icon: VideoIcon, label: "Video" },
  { id: "text", icon: Type, label: "Text" },
  { id: "music", icon: Music2, label: "Music" },
  { id: "poll", icon: BarChart3, label: "Poll" },
  { id: "question", icon: HelpCircle, label: "Question" },
  { id: "quiz", icon: Brain, label: "Quiz" },
  { id: "countdown", icon: Timer, label: "Countdown" },
  { id: "location", icon: MapPin, label: "Location" },
  { id: "link", icon: Link2, label: "Link" },
  { id: "mention", icon: AtSign, label: "Mention" },
] as const;

const PRIVACY = [
  { id: "everyone", label: "Everyone", icon: Globe },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "close", label: "Close friends", icon: UserCheck },
  { id: "selected", label: "Selected people", icon: Shield },
] as const;

const GRADIENTS = [
  "linear-gradient(135deg,#7c3aed,#ec4899)",
  "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#06b6d4)",
  "linear-gradient(135deg,#a8edea,#fed6e3)",
  "linear-gradient(135deg,#0f172a,#312e81)",
];

const FONTS = ["font-sans", "font-serif", "font-mono"];

export default function Status() {
  const { user, profile } = useAuth();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<string>("text");

  // Form state
  const [text, setText] = useState("");
  const [bg, setBg] = useState(GRADIENTS[0]);
  const [fontIdx, setFontIdx] = useState(0);
  const [fontSize, setFontSize] = useState(28);
  const [fontColor, setFontColor] = useState("#ffffff");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [filterBrightness, setFilterBrightness] = useState(100);
  const [filterContrast, setFilterContrast] = useState(100);
  const [filterSaturate, setFilterSaturate] = useState(100);
  const [filterBlur, setFilterBlur] = useState(0);
  const [filterPreset, setFilterPreset] = useState("none");
  const [pollOptions, setPollOptions] = useState<string[]>(["Yes", "No"]);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [countdownEnd, setCountdownEnd] = useState("");
  const [countdownTitle, setCountdownTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicThumb, setMusicThumb] = useState("");
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [musicStart, setMusicStart] = useState(0);
  const [muteOriginal, setMuteOriginal] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [privacy, setPrivacy] = useState<string>("everyone");
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  const [uploading, setUploading] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // Viewer
  const [viewerList, setViewerList] = useState<any[]>([]);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const advanceTimer = useRef<number | null>(null);

  const FILTER_PRESETS: Record<string, string> = {
    none: "",
    mono: "grayscale(100%)",
    sepia: "sepia(80%)",
    vivid: "saturate(160%) contrast(110%)",
    cool: "hue-rotate(-15deg) saturate(120%)",
    warm: "hue-rotate(15deg) saturate(120%) brightness(105%)",
    fade: "saturate(70%) contrast(90%) brightness(105%)",
    noir: "grayscale(100%) contrast(140%) brightness(90%)",
  };

  const filterStyle = `brightness(${filterBrightness}%) contrast(${filterContrast}%) saturate(${filterSaturate}%) blur(${filterBlur}px) ${FILTER_PRESETS[filterPreset] || ""}`;

  const load = async () => {
    const { data: rows } = await supabase
      .from("statuses")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const list = rows || [];
    const ids = Array.from(new Set(list.map((s: any) => s.user_id)));
    const profMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, name, avatar_url, username").in("id", ids);
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
    const ch = supabase.channel("stories-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_views" }, loadSeen)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_poll_votes" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

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

  const resetForm = () => {
    setText(""); setMediaFile(null); setMediaPreview(null);
    setFilterBrightness(100); setFilterContrast(100); setFilterSaturate(100); setFilterBlur(0); setFilterPreset("none");
    setPollOptions(["Yes", "No"]); setQuizCorrect(0);
    setCountdownEnd(""); setCountdownTitle("");
    setLinkUrl(""); setLinkTitle("");
    setMusicTitle(""); setMusicArtist(""); setMusicUrl("");
    setLocationName("");
  };

  const openComposer = (type: string) => {
    resetForm();
    setComposerType(type);
    setComposerOpen(true);
    if (type === "photo") setTimeout(() => photoRef.current?.click(), 50);
    if (type === "video") setTimeout(() => videoRef.current?.click(), 50);
  };

  const onMediaSelected = (file: File) => {
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  // Apply CSS filters to an image via canvas before uploading
  const bakeFiltersToBlob = async (file: File): Promise<Blob> => {
    if (!file.type.startsWith("image/") || filterStyle.trim() === "brightness(100%) contrast(100%) saturate(100%) blur(0px) ") {
      return file;
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        (ctx as any).filter = filterStyle;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("no blob")), "image/jpeg", 0.92);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const post = async () => {
    if (!user) return;
    setUploading(true);
    try {
      let media_url: string | null = null;
      let media_type: string | null = null;

      if (mediaFile) {
        const blob = await bakeFiltersToBlob(mediaFile);
        const ext = mediaFile.type.startsWith("video/") ? "mp4" : "jpg";
        const path = `${user.id}/story-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: mediaFile.type });
        if (upErr) throw upErr;
        const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 30);
        media_url = data?.signedUrl || null;
        media_type = mediaFile.type.startsWith("video/") ? "video" : "image";
      }

      const base: any = {
        user_id: user.id,
        story_type: composerType,
        privacy,
        allow_replies: allowReplies,
        allow_reactions: allowReactions,
        allow_sharing: allowSharing,
        background: bg,
        layers: { font: FONTS[fontIdx], fontSize, fontColor },
      };

      if (composerType === "text") base.content = text;
      if (composerType === "photo" || composerType === "video") {
        base.media_url = media_url; base.media_type = media_type; base.content = text || null;
      }
      if (composerType === "poll") {
        base.poll_question = text || "Make a choice";
        base.poll_options = pollOptions.filter(Boolean);
      }
      if (composerType === "question") base.question_prompt = text || "Ask me anything";
      if (composerType === "quiz") {
        base.poll_question = text || "Take the quiz";
        base.quiz_options = pollOptions.filter(Boolean);
        base.quiz_correct_index = quizCorrect;
      }
      if (composerType === "countdown") {
        base.countdown_title = countdownTitle || text;
        base.countdown_end = countdownEnd ? new Date(countdownEnd).toISOString() : null;
      }
      if (composerType === "link") { base.link_url = linkUrl; base.link_title = linkTitle || text; }
      if (composerType === "music") {
        base.music_url = musicUrl; base.music_title = musicTitle; base.music_artist = musicArtist;
        base.music_thumbnail = musicThumb || null;
        base.music_start_seconds = musicStart;
        base.media_url = media_url; base.media_type = media_type;
      }
      // Music attachment on photo/video/text stories
      if (musicUrl && composerType !== "music" && ["photo","video","text"].includes(composerType)) {
        base.music_url = musicUrl; base.music_title = musicTitle; base.music_artist = musicArtist;
        base.music_thumbnail = musicThumb || null;
        base.music_start_seconds = musicStart;
        if (composerType === "video") base.mute_original = muteOriginal;
      }
      if (composerType === "location") base.location = { name: locationName };

      const { error } = await supabase.from("statuses").insert(base);
      if (error) throw error;
      toast.success("Story posted");
      setComposerOpen(false); resetForm();
    } catch (e: any) {
      toast.error(e.message || "Could not post");
    } finally { setUploading(false); }
  };

  const openViewer = (list: any[]) => {
    const startIdx = list.findIndex((s) => !seenIds.has(s.id));
    setViewerList(list);
    setViewerIdx(startIdx === -1 ? 0 : startIdx);
  };
  const closeViewer = () => { setViewerList([]); setViewerIdx(0); setViewers([]); setReplyText(""); };

  const current = viewerList[viewerIdx];

  useEffect(() => {
    if (!current || !user) return;
    if (current.user_id !== user.id && !seenIds.has(current.id)) {
      supabase.from("status_views").insert({ status_id: current.id, viewer_id: user.id }).then(() => {
        setSeenIds((prev) => new Set([...prev, current.id]));
      });
    }
    if (current.user_id === user.id) {
      supabase.rpc("get_status_views", { _status_id: current.id }).then(({ data }) => setViewers(data || []));
    } else setViewers([]);

    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    const skipAuto = ["video", "poll", "question", "quiz", "countdown"].includes(current.story_type);
    if (!skipAuto) advanceTimer.current = window.setTimeout(() => goNext(), STORY_DURATION_MS);
    return () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIdx, viewerList]);

  const goNext = () => setViewerIdx((i) => i + 1 >= viewerList.length ? (closeViewer(), 0) : i + 1);
  const goPrev = () => setViewerIdx((i) => Math.max(0, i - 1));

  const reactToStory = async (emoji: string) => {
    if (!current || !user) return;
    await supabase.from("story_reactions").upsert({ status_id: current.id, user_id: user.id, emoji });
    toast.success(`Reacted ${emoji}`);
  };

  const sendReply = async () => {
    if (!current || !user || !replyText.trim()) return;
    await supabase.from("story_replies").insert({ status_id: current.id, user_id: user.id, body: replyText.trim() });
    setReplyText(""); toast.success("Reply sent");
  };

  const voteOnPoll = async (idx: number) => {
    if (!current || !user) return;
    await supabase.from("story_poll_votes").upsert({ status_id: current.id, user_id: user.id, choice_index: idx });
    toast.success("Vote recorded");
  };

  const renderEditor = () => {
    const showMedia = composerType === "photo" || composerType === "video" || composerType === "music";
    const showText = ["text", "poll", "question", "quiz", "countdown", "link"].includes(composerType);

    return (
      <div className="space-y-3">
        {/* Preview canvas */}
        <div
          className="relative rounded-2xl overflow-hidden flex items-center justify-center min-h-[280px]"
          style={{ background: bg }}
        >
          {mediaPreview && composerType === "photo" && (
            <img src={mediaPreview} alt="" className="max-h-[280px] w-full object-cover" style={{ filter: filterStyle }} />
          )}
          {mediaPreview && composerType === "video" && (
            <video src={mediaPreview} className="max-h-[280px] w-full object-cover" style={{ filter: filterStyle }} muted autoPlay loop />
          )}
          {composerType === "text" && (
            <p className={`p-6 text-center ${FONTS[fontIdx]} break-words`} style={{ fontSize, color: fontColor, fontWeight: 700 }}>
              {text || "Type something…"}
            </p>
          )}
          {composerType === "poll" && (
            <div className="p-5 w-full">
              <p className="text-white font-bold text-lg mb-3 text-center">{text || "Make a choice"}</p>
              <div className="space-y-2">
                {pollOptions.map((o, i) => (
                  <div key={i} className="bg-white/90 rounded-xl px-4 py-2.5 text-sm font-medium">{o || `Option ${i+1}`}</div>
                ))}
              </div>
            </div>
          )}
          {composerType === "question" && (
            <div className="p-5 w-full">
              <p className="text-white text-xs uppercase tracking-wider opacity-80 mb-1 text-center">Ask me</p>
              <p className="text-white font-bold text-xl text-center mb-3">{text || "Ask me anything"}</p>
              <div className="bg-white/90 rounded-xl p-3 text-sm text-muted-foreground italic">Type your answer…</div>
            </div>
          )}
          {composerType === "quiz" && (
            <div className="p-5 w-full">
              <p className="text-white font-bold text-lg mb-3 text-center">{text || "Take the quiz"}</p>
              <div className="space-y-2">
                {pollOptions.map((o, i) => (
                  <div key={i} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${i === quizCorrect ? "bg-emerald-400 text-white" : "bg-white/90"}`}>{o || `Option ${i+1}`}</div>
                ))}
              </div>
            </div>
          )}
          {composerType === "countdown" && (
            <div className="p-5 text-center text-white">
              <Timer className="w-10 h-10 mx-auto mb-2" />
              <p className="font-bold text-xl">{countdownTitle || text || "Countdown"}</p>
              <p className="text-sm opacity-80">{countdownEnd ? new Date(countdownEnd).toLocaleString() : "Pick a date"}</p>
            </div>
          )}
          {composerType === "link" && (
            <div className="p-5 text-center text-white">
              <Link2 className="w-10 h-10 mx-auto mb-2" />
              <p className="font-bold text-lg">{linkTitle || text || "Open link"}</p>
              <p className="text-xs opacity-80 truncate">{linkUrl || "https://…"}</p>
            </div>
          )}
          {composerType === "music" && (
            <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur rounded-2xl p-3 flex items-center gap-3 text-white">
              <Music2 className="w-5 h-5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{musicTitle || "Song title"}</p>
                <p className="text-xs opacity-80 truncate">{musicArtist || "Artist"}</p>
              </div>
            </div>
          )}
          {composerType === "location" && (
            <div className="text-center text-white p-5">
              <MapPin className="w-10 h-10 mx-auto mb-2" />
              <p className="font-bold text-lg">{locationName || "Location"}</p>
            </div>
          )}
        </div>

        {/* Text input */}
        {showText && (
          <Textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={
              composerType === "poll" ? "Poll question" :
              composerType === "quiz" ? "Quiz question" :
              composerType === "question" ? "Question prompt" :
              composerType === "countdown" ? "Title (optional)" :
              composerType === "link" ? "Title shown on story" :
              "Type something…"
            }
            className="rounded-2xl min-h-[60px] resize-none"
          />
        )}

        {/* Type-specific extras */}
        {(composerType === "poll" || composerType === "quiz") && (
          <div className="space-y-2">
            {pollOptions.map((o, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={o} onChange={(e) => { const c = [...pollOptions]; c[i] = e.target.value; setPollOptions(c); }} placeholder={`Option ${i+1}`} className="rounded-full h-10" />
                {composerType === "quiz" && (
                  <button onClick={() => setQuizCorrect(i)} className={`w-8 h-8 rounded-full text-xs font-bold ${quizCorrect === i ? "bg-emerald-500 text-white" : "bg-muted"}`}>✓</button>
                )}
                {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, x) => x !== i))}><X className="w-4 h-4" /></button>}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-xs font-semibold" style={{ color: "hsl(var(--primary))" }}>+ Add option</button>
            )}
          </div>
        )}
        {composerType === "countdown" && (
          <div className="space-y-2">
            <Input value={countdownTitle} onChange={(e) => setCountdownTitle(e.target.value)} placeholder="Countdown title" className="rounded-full h-10" />
            <Input type="datetime-local" value={countdownEnd} onChange={(e) => setCountdownEnd(e.target.value)} className="rounded-full h-10" />
          </div>
        )}
        {composerType === "link" && (
          <div className="space-y-2">
            <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title" className="rounded-full h-10" />
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="rounded-full h-10" />
          </div>
        )}
        {composerType === "music" && (
          <div className="space-y-2">
            {musicTitle ? (
              <div className="flex items-center gap-3 p-2 rounded-2xl bg-muted">
                {musicThumb && <img src={musicThumb} alt="" className="w-12 h-12 rounded-lg" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{musicTitle}</p>
                  <p className="text-xs text-muted-foreground truncate">{musicArtist}</p>
                </div>
                <Button size="sm" variant="ghost" className="rounded-full"
                  onClick={() => { setMusicTitle(""); setMusicArtist(""); setMusicUrl(""); setMusicThumb(""); }}>
                  Change
                </Button>
              </div>
            ) : (
              <Button onClick={() => setMusicPickerOpen(true)} className="w-full rounded-full h-11" variant="outline">
                <Music2 className="w-4 h-4 mr-2" /> Search music
              </Button>
            )}
          </div>
        )}
        {composerType === "location" && (
          <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Location name" className="rounded-full h-10" />
        )}

        {/* Text styling for text stories */}
        {composerType === "text" && (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-14">Size</span>
              <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={14} max={64} step={1} />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-14">Font</span>
              {FONTS.map((f, i) => (
                <button key={f} onClick={() => setFontIdx(i)} className={`px-3 h-8 rounded-full text-xs ${f} ${fontIdx === i ? "bg-foreground text-background" : "bg-muted"}`}>Aa</button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-14">Color</span>
              {["#ffffff", "#000000", "#fbbf24", "#ef4444", "#22d3ee", "#a78bfa"].map((c) => (
                <button key={c} onClick={() => setFontColor(c)} className={`w-7 h-7 rounded-full border-2 ${fontColor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
        )}

        {/* Background */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {GRADIENTS.map((g) => (
            <button key={g} onClick={() => setBg(g)} className={`w-9 h-9 rounded-full shrink-0 ${bg === g ? "ring-2 ring-foreground" : ""}`} style={{ background: g }} />
          ))}
        </div>

        {/* Image filters */}
        {showMedia && mediaPreview && (
          <div className="space-y-3 p-3 bg-muted/40 rounded-2xl">
            <div className="flex items-center gap-2"><Sliders className="w-4 h-4" /><span className="text-sm font-semibold">Filters</span></div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {Object.keys(FILTER_PRESETS).map((p) => (
                <button key={p} onClick={() => setFilterPreset(p)} className={`px-3 h-8 rounded-full text-xs capitalize shrink-0 ${filterPreset === p ? "bg-foreground text-background" : "bg-background"}`}>{p}</button>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 items-center"><span className="text-xs w-16">Brightness</span><Slider value={[filterBrightness]} onValueChange={([v]) => setFilterBrightness(v)} min={50} max={150} /></div>
              <div className="flex gap-2 items-center"><span className="text-xs w-16">Contrast</span><Slider value={[filterContrast]} onValueChange={([v]) => setFilterContrast(v)} min={50} max={150} /></div>
              <div className="flex gap-2 items-center"><span className="text-xs w-16">Saturate</span><Slider value={[filterSaturate]} onValueChange={([v]) => setFilterSaturate(v)} min={0} max={200} /></div>
              <div className="flex gap-2 items-center"><span className="text-xs w-16">Blur</span><Slider value={[filterBlur]} onValueChange={([v]) => setFilterBlur(v)} min={0} max={10} /></div>
            </div>
          </div>
        )}

        {/* Privacy */}
        <div className="p-3 bg-muted/40 rounded-2xl space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Shield className="w-4 h-4" /> Privacy</p>
          <div className="grid grid-cols-2 gap-2">
            {PRIVACY.map((p) => (
              <button key={p.id} onClick={() => setPrivacy(p.id)} className={`flex items-center gap-2 px-3 h-10 rounded-full text-xs font-medium ${privacy === p.id ? "bg-foreground text-background" : "bg-background"}`}>
                <p.icon className="w-3.5 h-3.5" /> {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => setAllowReplies(!allowReplies)} className={`px-3 h-7 rounded-full text-[11px] ${allowReplies ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>Replies {allowReplies ? "on" : "off"}</button>
            <button onClick={() => setAllowReactions(!allowReactions)} className={`px-3 h-7 rounded-full text-[11px] ${allowReactions ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>Reactions {allowReactions ? "on" : "off"}</button>
            <button onClick={() => setAllowSharing(!allowSharing)} className={`px-3 h-7 rounded-full text-[11px] ${allowSharing ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>Sharing {allowSharing ? "on" : "off"}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Stories</h1>
        <button onClick={() => { resetForm(); setComposerType("text"); setComposerOpen(true); }} className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Story-type quick picker */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {STORY_TYPES.slice(0, 8).map((t) => (
          <button key={t.id} onClick={() => openComposer(t.id)} className="flex flex-col items-center gap-1 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] active:scale-95 transition-transform">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-cta)" }}><t.icon className="w-4 h-4" /></div>
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {/* My story */}
      <button onClick={() => myStatuses.length ? openViewer(myStatuses) : openComposer("text")} className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] mb-6">
        <div className="relative">
          <div className={myStatuses.length ? "status-ring-mine" : ""}>
            <Avatar className="w-14 h-14 ring-2 ring-background">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.name?.[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow" style={{ background: "var(--gradient-cta)" }}><Plus className="w-3.5 h-3.5" /></div>
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold">My story</p>
          <p className="text-xs text-muted-foreground">{myStatuses.length ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""}` : "Tap to add"}</p>
        </div>
      </button>

      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-2">Recent updates</p>
      <div className="space-y-2">
        {otherEntries.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No recent stories</p>}
        {otherEntries.map(([uid, list]) => {
          const unseen = allUnseenForUser(list);
          const latest = list[list.length - 1];
          return (
            <button key={uid} onClick={() => openViewer(list)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/60">
              <div className={unseen ? "status-ring-unseen" : "status-ring-seen"}>
                <Avatar className="w-12 h-12 ring-2 ring-background">
                  <AvatarImage src={latest.profiles?.avatar_url || undefined} />
                  <AvatarFallback>{latest.profiles?.name?.[0]}</AvatarFallback>
                </Avatar>
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold">{latest.profiles?.name}</p>
                <p className="text-xs text-muted-foreground">{list.length} update{list.length > 1 ? "s" : ""} · {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Composer */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="border-0 max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>New {composerType} story</DialogTitle></DialogHeader>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
            {STORY_TYPES.map((t) => (
              <button key={t.id} onClick={() => setComposerType(t.id)} className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium shrink-0 ${composerType === t.id ? "bg-foreground text-background" : "bg-muted"}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onMediaSelected(e.target.files[0])} />
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && onMediaSelected(e.target.files[0])} />
          {(composerType === "photo" || composerType === "video" || composerType === "music") && !mediaPreview && (
            <button onClick={() => (composerType === "video" ? videoRef : photoRef).current?.click()} className="w-full p-8 border-2 border-dashed rounded-2xl text-sm text-muted-foreground">Tap to pick {composerType === "video" ? "a video" : "an image"}{composerType === "music" ? " (optional cover)" : ""}</button>
          )}
          {renderEditor()}
          <Button onClick={post} disabled={uploading} className="w-full rounded-full h-12 text-white border-0 mt-2" style={{ background: "var(--gradient-cta)" }}>
            {uploading ? "Posting…" : "Share story"}
          </Button>
        </DialogContent>
      </Dialog>
      <MusicPicker
        open={musicPickerOpen}
        onOpenChange={setMusicPickerOpen}
        onSelect={(t) => {
          setMusicTitle(t.title); setMusicArtist(t.artist);
          setMusicUrl(t.previewUrl); setMusicThumb(t.artworkUrl);
        }}
      />

      {/* Viewer */}
      {current && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-20">
            {viewerList.map((s, i) => (
              <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div className={i < viewerIdx ? "h-full bg-white" : i === viewerIdx ? "story-bar-fill" : ""} style={i === viewerIdx ? { animationDuration: `${STORY_DURATION_MS}ms` } : { width: i < viewerIdx ? "100%" : "0%" }} />
              </div>
            ))}
          </div>
          <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-20">
            <div className="flex items-center gap-2">
              <Avatar className="w-9 h-9 ring-2 ring-white">
                <AvatarImage src={current.profiles?.avatar_url || undefined} />
                <AvatarFallback>{current.profiles?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-semibold text-sm">{current.profiles?.name || "You"}</p>
                <p className="text-white/70 text-xs">{formatDistanceToNow(new Date(current.created_at), { addSuffix: true })} · {current.story_type}</p>
              </div>
            </div>
            <button onClick={closeViewer} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5 text-white" /></button>
          </div>

          <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
          <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" />

          {/* Content */}
          <div className="flex-1 flex items-center justify-center" style={{ background: current.background || "var(--gradient-cta)" }}>
            {current.media_type === "image" && current.media_url && <img src={current.media_url} alt="" className="max-h-full max-w-full object-contain" />}
            {current.media_type === "video" && current.media_url && <video src={current.media_url} autoPlay playsInline controls={false} onEnded={goNext} className="max-h-full max-w-full" />}
            {current.story_type === "text" && (
              <p className="font-bold text-center px-8" style={{ fontSize: current.layers?.fontSize || 28, color: current.layers?.fontColor || "#fff" }}>{current.content}</p>
            )}
            {current.story_type === "poll" && (
              <div className="p-6 w-full max-w-md">
                <p className="text-white font-bold text-xl mb-4 text-center">{current.poll_question}</p>
                <div className="space-y-2">
                  {(current.poll_options || []).map((o: string, i: number) => (
                    <button key={i} onClick={() => voteOnPoll(i)} className="w-full bg-white/90 rounded-2xl px-4 py-3 text-sm font-semibold active:scale-95 transition-transform">{o}</button>
                  ))}
                </div>
              </div>
            )}
            {current.story_type === "question" && (
              <div className="p-6 w-full max-w-md text-center text-white">
                <p className="text-xs uppercase opacity-80 mb-1">Ask me</p>
                <p className="font-bold text-2xl mb-4">{current.question_prompt}</p>
                <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your answer…" className="bg-white/90 rounded-full h-12" />
                <Button onClick={sendReply} className="mt-3 rounded-full w-full" style={{ background: "var(--gradient-cta)" }}>Send</Button>
              </div>
            )}
            {current.story_type === "quiz" && (
              <div className="p-6 w-full max-w-md">
                <p className="text-white font-bold text-xl mb-4 text-center">{current.poll_question}</p>
                <div className="space-y-2">
                  {(current.quiz_options || []).map((o: string, i: number) => (
                    <button key={i} onClick={() => { voteOnPoll(i); toast(i === current.quiz_correct_index ? "Correct! 🎉" : "Not quite"); }} className="w-full bg-white/90 rounded-2xl px-4 py-3 text-sm font-semibold">{o}</button>
                  ))}
                </div>
              </div>
            )}
            {current.story_type === "countdown" && (
              <div className="text-center text-white p-6">
                <Timer className="w-12 h-12 mx-auto mb-3" />
                <p className="font-bold text-2xl mb-2">{current.countdown_title}</p>
                <p className="text-3xl font-mono">{current.countdown_end ? formatDistanceToNow(new Date(current.countdown_end), { addSuffix: true }) : ""}</p>
              </div>
            )}
            {current.story_type === "link" && (
              <a href={current.link_url} target="_blank" rel="noreferrer" className="text-center text-white p-6 bg-white/10 rounded-3xl backdrop-blur">
                <Link2 className="w-12 h-12 mx-auto mb-2" />
                <p className="font-bold text-xl">{current.link_title}</p>
                <p className="text-sm opacity-80 underline">{current.link_url}</p>
              </a>
            )}
            {current.story_type === "music" && (
              <div className="text-center text-white">
                <Music2 className="w-20 h-20 mx-auto mb-3" />
                <p className="font-bold text-xl">{current.music_title}</p>
                <p className="text-sm opacity-80">{current.music_artist}</p>
                {current.music_url && <a href={current.music_url} target="_blank" rel="noreferrer" className="text-xs underline opacity-80 block mt-2">Play</a>}
              </div>
            )}
            {current.story_type === "location" && (
              <div className="text-center text-white">
                <MapPin className="w-16 h-16 mx-auto mb-3" />
                <p className="font-bold text-xl">{current.location?.name}</p>
              </div>
            )}
          </div>

          {/* Reactions/reply bar */}
          {current.user_id !== user?.id && (
            <div className="bg-black/70 backdrop-blur p-3 flex items-center gap-2 z-20">
              {current.allow_reactions && (
                <div className="flex gap-1">
                  {["❤️","🔥","😂","😮","👏"].map((e) => (
                    <button key={e} onClick={() => reactToStory(e)} className="w-9 h-9 rounded-full bg-white/10 text-lg active:scale-90 transition-transform">{e}</button>
                  ))}
                </div>
              )}
              {current.allow_replies && (
                <>
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Reply…" className="flex-1 bg-white/10 rounded-full px-4 h-9 text-sm text-white placeholder:text-white/50 outline-none" />
                  <button onClick={sendReply} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center"><Send className="w-4 h-4" /></button>
                </>
              )}
            </div>
          )}

          {current.user_id === user?.id && (
            <div className="bg-black/70 backdrop-blur p-4 max-h-48 overflow-y-auto z-20">
              <p className="text-xs uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Viewed by {viewers.length}</p>
              {viewers.map((v: any) => (
                <div key={v.viewer_id} className="flex items-center gap-2 py-1">
                  <Avatar className="w-8 h-8"><AvatarImage src={v.avatar_url || undefined} /><AvatarFallback>{v.name?.[0]}</AvatarFallback></Avatar>
                  <p className="text-sm flex-1 truncate text-white">{v.name}</p>
                  <p className="text-xs text-white/60">{formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

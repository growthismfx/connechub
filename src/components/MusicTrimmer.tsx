import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause, Music2, X } from "lucide-react";

type Props = {
  previewUrl: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  startSeconds: number;
  onStartChange: (s: number) => void;
  onRemove?: () => void;
  clipSeconds?: number; // how long the clip on story will play (visual only)
  maxSeconds?: number;  // upper bound on start (default 25 for 30s preview)
};

export default function MusicTrimmer({
  previewUrl, title, artist, artworkUrl,
  startSeconds, onStartChange, onRemove,
  clipSeconds = 5, maxSeconds = 25,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(startSeconds);

  useEffect(() => {
    const a = new Audio(previewUrl);
    a.crossOrigin = "anonymous";
    audioRef.current = a;
    const onTime = () => setNow(a.currentTime);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause(); a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [previewUrl]);

  useEffect(() => {
    // Stop playback once we cross start + clipSeconds
    if (playing && audioRef.current && now >= startSeconds + clipSeconds) {
      audioRef.current.pause(); setPlaying(false);
    }
  }, [now, playing, startSeconds, clipSeconds]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    a.currentTime = startSeconds;
    a.play().then(() => setPlaying(true)).catch(() => {});
  };

  const setStart = (v: number) => {
    onStartChange(v);
    if (audioRef.current) audioRef.current.currentTime = v;
    setNow(v);
  };

  const pct = Math.min(100, Math.max(0, (now / (maxSeconds + clipSeconds)) * 100));

  return (
    <div className="p-3 rounded-2xl bg-muted space-y-3">
      <div className="flex items-center gap-3">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="w-12 h-12 rounded-lg" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <Music2 className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{artist}</p>
        </div>
        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        {onRemove && (
          <Button size="icon" variant="ghost" className="rounded-full h-9 w-9" onClick={onRemove} aria-label="Remove">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div>
        <div className="relative h-2 rounded-full bg-background overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-primary/40 rounded-full"
            style={{
              left: `${(startSeconds / (maxSeconds + clipSeconds)) * 100}%`,
              width: `${(clipSeconds / (maxSeconds + clipSeconds)) * 100}%`,
            }}
          />
          <div className="absolute top-0 bottom-0 bg-primary rounded-full transition-all" style={{ width: `${pct}%`, opacity: playing ? 1 : 0 }} />
        </div>
        <div className="mt-3">
          <Slider
            value={[startSeconds]}
            min={0}
            max={maxSeconds}
            step={0.5}
            onValueChange={(v) => setStart(v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Start {startSeconds.toFixed(1)}s</span>
            <span>Clip {clipSeconds}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  clipSeconds: number;
  onClipChange?: (s: number) => void;
  onRemove?: () => void;
  minClip?: number;
  maxClip?: number;
  totalSeconds?: number; // preview total, defaults 30 (iTunes)
};

export default function MusicTrimmer({
  previewUrl, title, artist, artworkUrl,
  startSeconds, onStartChange,
  clipSeconds, onClipChange,
  onRemove, minClip = 3, maxClip = 30, totalSeconds = 30,
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

  const maxStart = Math.max(0, totalSeconds - clipSeconds);
  const effectiveStart = Math.min(startSeconds, maxStart);
  const setStart = (v: number) => {
    onStartChange(v);
    if (audioRef.current) audioRef.current.currentTime = v;
    setNow(v);
  };

  const setClip = (v: number) => {
    if (!onClipChange) return;
    onClipChange(v);
    if (startSeconds + v > totalSeconds) onStartChange(Math.max(0, totalSeconds - v));
  };

  const pct = Math.min(100, Math.max(0, (now / totalSeconds) * 100));

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
              left: `${(effectiveStart / totalSeconds) * 100}%`,
              width: `${(clipSeconds / totalSeconds) * 100}%`,
            }}
          />
          <div className="absolute top-0 bottom-0 bg-primary rounded-full transition-all" style={{ width: `${pct}%`, opacity: playing ? 1 : 0 }} />
        </div>

        <div className="mt-3">
          <p className="text-[10px] text-muted-foreground mb-1">Start position</p>
          <Slider
            value={[effectiveStart]}
            min={0}
            max={maxStart}
            step={0.5}
            onValueChange={(v) => setStart(v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{effectiveStart.toFixed(1)}s</span>
            <span>{maxStart.toFixed(1)}s</span>
          </div>
        </div>

        {onClipChange && (
          <div className="mt-3">
            <p className="text-[10px] text-muted-foreground mb-1">Clip length · {clipSeconds}s</p>
            <Slider
              value={[clipSeconds]}
              min={minClip}
              max={maxClip}
              step={1}
              onValueChange={(v) => setClip(v[0])}
            />
          </div>
        )}
      </div>
    </div>
  );
}

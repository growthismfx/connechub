import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Play, Pause, Music2 } from "lucide-react";

export type MusicTrack = {
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (track: MusicTrack) => void;
};

export default function MusicPicker({ open, onOpenChange, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio() : null));

  useEffect(() => {
    if (!open) { audio?.pause(); setPlayingId(null); }
  }, [open, audio]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // iTunes Search API — free, no key, 30-sec previews
        const url = `https://itunes.apple.com/search?media=music&limit=20&term=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const togglePreview = (r: any) => {
    if (!audio) return;
    if (playingId === r.trackId) { audio.pause(); setPlayingId(null); return; }
    audio.src = r.previewUrl;
    audio.play().catch(() => {});
    setPlayingId(r.trackId);
    audio.onended = () => setPlayingId(null);
  };

  const pick = (r: any) => {
    audio?.pause();
    onSelect({
      title: r.trackName,
      artist: r.artistName,
      previewUrl: r.previewUrl,
      artworkUrl: (r.artworkUrl100 || "").replace("100x100", "600x600"),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2"><Music2 className="w-4 h-4" /> Search music</DialogTitle>
        </DialogHeader>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Song, artist, album…" className="pl-9 rounded-full h-10" />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <p className="text-xs text-center text-muted-foreground py-6">Searching…</p>}
          {!loading && !results.length && q && <p className="text-xs text-center text-muted-foreground py-6">No results</p>}
          {results.map((r) => (
            <div key={r.trackId} className="flex items-center gap-3 p-3 hover:bg-muted/50">
              <button onClick={() => togglePreview(r)} className="relative shrink-0">
                <img src={r.artworkUrl100} alt="" className="w-12 h-12 rounded-lg" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition">
                  {playingId === r.trackId ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                </span>
              </button>
              <button onClick={() => pick(r)} className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold truncate">{r.trackName}</p>
                <p className="text-xs text-muted-foreground truncate">{r.artistName}</p>
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

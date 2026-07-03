import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, THEMES } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const WALLPAPERS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "None", css: "" },
  { id: "peach", label: "Peach", css: "linear-gradient(135deg,#ffe5c4,#fbc4d4)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(135deg,#a1c4fd,#c2e9fb)" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(135deg,#ff9a9e,#fecfef,#fecfef)" },
  { id: "forest", label: "Forest", css: "linear-gradient(135deg,#84fab0,#8fd3f4)" },
  { id: "candy", label: "Candy", css: "linear-gradient(135deg,#fbc2eb,#a6c1ee)" },
  { id: "midnight", label: "Midnight", css: "linear-gradient(135deg,#0f172a,#312e81)" },
  { id: "lavender", label: "Lavender", css: "linear-gradient(135deg,#d4a5ff,#b8c6ff)" },
  { id: "coral", label: "Coral", css: "linear-gradient(135deg,#ff6a88,#ffb199)" },
  { id: "mint", label: "Mint", css: "linear-gradient(135deg,#96e6a1,#d4fc79)" },
  { id: "sky", label: "Sky", css: "linear-gradient(135deg,#89f7fe,#66a6ff)" },
  { id: "rose", label: "Rose Gold", css: "linear-gradient(135deg,#f6d365,#fda085)" },
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg,#fbc2eb,#a6c1ee,#84fab0)" },
];

export default function AppearanceSettings() {
  const nav = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const currentWp = (profile as any)?.wallpaper_url || "";
  const [busy, setBusy] = useState(false);

  const setWallpaper = async (value: string) => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ wallpaper_url: value } as any).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Wallpaper updated");
  };

  const uploadCustom = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const path = `${user.id}/wallpaper-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await setWallpaper(data.publicUrl);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 sticky top-0 z-10 bg-background/70 backdrop-blur">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold">Appearance</h1>
      </div>

      <div className="px-5 space-y-6 mt-2">
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Theme</p>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative rounded-2xl p-4 text-left border-2 transition-all overflow-hidden h-24 ${theme === t.id ? "border-foreground scale-[0.98]" : "border-transparent"}`}
                style={{ background: t.preview }}
              >
                <p className="font-semibold text-sm relative z-10" style={{ color: t.dark ? "white" : "#111" }}>{t.name}</p>
                <p className="text-[10px] opacity-80 relative z-10" style={{ color: t.dark ? "white" : "#111" }}>{t.description}</p>
                {theme === t.id && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center z-10"><Check className="w-3.5 h-3.5 text-foreground" /></span>}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chat wallpaper</p>
          <div className="grid grid-cols-3 gap-2.5">
            {WALLPAPERS.map((wp) => {
              const selected = (wp.id === "none" && !currentWp) || currentWp === wp.css;
              return (
                <button
                  key={wp.id}
                  onClick={() => setWallpaper(wp.id === "none" ? "" : wp.css)}
                  disabled={busy}
                  className={`relative aspect-[3/4] rounded-xl border-2 transition-all ${selected ? "border-foreground" : "border-transparent"}`}
                  style={{ background: wp.css || "hsl(var(--muted))" }}
                >
                  <span className="absolute bottom-1.5 left-2 text-[10px] font-medium" style={{ color: wp.id === "midnight" ? "white" : "#111", textShadow: "0 1px 2px rgba(255,255,255,.5)" }}>{wp.label}</span>
                  {selected && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center"><Check className="w-3 h-3 text-foreground" /></span>}
                </button>
              );
            })}
            <label className="relative aspect-[3/4] rounded-xl border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Upload</span>
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadCustom(e.target.files[0])} />
            </label>
          </div>
          {currentWp && currentWp.startsWith("http") && (
            <Button variant="outline" onClick={() => setWallpaper("")} className="w-full mt-3 rounded-full">Remove custom wallpaper</Button>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, ImagePlus, Music2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

export default function EditProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(""); const [username, setUsername] = useState("");
  const [bio, setBio] = useState(""); const [pronouns, setPronouns] = useState("");
  const [location, setLocation] = useState(""); const [website, setWebsite] = useState("");
  const [profileMusicTitle, setProfileMusicTitle] = useState(""); const [profileMusicUrl, setProfileMusicUrl] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || ""); setUsername(profile.username || "");
    setBio((profile as any).bio || ""); setPronouns((profile as any).pronouns || "");
    setLocation((profile as any).location || ""); setWebsite((profile as any).website || "");
    setProfileMusicTitle((profile as any).profile_music_title || "");
    setProfileMusicUrl((profile as any).profile_music_url || "");
    setLinks(((profile as any).links as any[]) || []);
    setSocial(((profile as any).social_links as Record<string, string>) || {});
  }, [profile]);

  const uploadImage = async (file: File, kind: "avatar" | "banner") => {
    if (!user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const col = kind === "avatar" ? "avatar_url" : "banner_url";
      await supabase.from("profiles").update({ [col]: data.publicUrl }).eq("id", user.id);
      await refreshProfile();
      toast.success(`${kind === "avatar" ? "Photo" : "Banner"} updated`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      name, username, bio, pronouns, location, website,
      links, social_links: social,
      profile_music_title: profileMusicTitle, profile_music_url: profileMusicUrl,
    }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved");
  };

  const banner = (profile as any)?.banner_url;

  return (
    <div className="min-h-screen pb-32">
      {/* Banner */}
      <div className="relative h-44 -mx-0" style={{ background: banner ? `url(${banner}) center/cover` : "var(--gradient-cta)" }}>
        <button onClick={() => nav(-1)} className="absolute top-10 left-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <button onClick={() => bannerRef.current?.click()} className="absolute top-10 right-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center"><ImagePlus className="w-4 h-4" /></button>
        <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
      </div>

      <div className="px-5 -mt-12">
        <button onClick={() => avatarRef.current?.click()} className="relative">
          <Avatar className="w-24 h-24 ring-4 ring-background">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">{profile?.name?.[0]}</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center"><Camera className="w-3.5 h-3.5" /></span>
        </button>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />

        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-full h-11 mt-1" /></div>
            <div><label className="text-xs text-muted-foreground">Username</label><Input value={username} onChange={(e) => setUsername(e.target.value)} className="rounded-full h-11 mt-1" /></div>
          </div>

          <div><label className="text-xs text-muted-foreground">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} placeholder="Tell people about you (200 chars)" className="rounded-2xl mt-1 resize-none" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Pronouns</label><Input value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="they/them" className="rounded-full h-11 mt-1" /></div>
            <div><label className="text-xs text-muted-foreground">Location</label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" className="rounded-full h-11 mt-1" /></div>
          </div>

          <div><label className="text-xs text-muted-foreground">Website</label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="rounded-full h-11 mt-1" /></div>

          {/* Social */}
          <div>
            <label className="text-xs text-muted-foreground">Social links</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {["instagram", "twitter", "github", "youtube", "tiktok", "linkedin"].map((k) => (
                <Input key={k} value={social[k] || ""} onChange={(e) => setSocial({ ...social, [k]: e.target.value })} placeholder={k} className="rounded-full h-10" />
              ))}
            </div>
          </div>

          {/* Custom links */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between">Custom links
              <button onClick={() => setLinks([...links, { label: "", url: "" }])} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}><Plus className="w-3 h-3" /> Add</button>
            </label>
            <div className="space-y-2 mt-1">
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={l.label} onChange={(e) => { const c = [...links]; c[i].label = e.target.value; setLinks(c); }} placeholder="Label" className="rounded-full h-10 w-1/3" />
                  <Input value={l.url} onChange={(e) => { const c = [...links]; c[i].url = e.target.value; setLinks(c); }} placeholder="URL" className="rounded-full h-10 flex-1" />
                  <button onClick={() => setLinks(links.filter((_, x) => x !== i))} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Profile music */}
          <div className="bg-muted/40 rounded-2xl p-3 space-y-2">
            <label className="text-xs font-semibold flex items-center gap-1.5"><Music2 className="w-3.5 h-3.5" /> Profile music</label>
            <Input value={profileMusicTitle} onChange={(e) => setProfileMusicTitle(e.target.value)} placeholder="Song title" className="rounded-full h-10" />
            <Input value={profileMusicUrl} onChange={(e) => setProfileMusicUrl(e.target.value)} placeholder="YouTube / audio URL" className="rounded-full h-10" />
          </div>

          <Button onClick={save} disabled={busy} className="w-full rounded-full h-12 text-white border-0" style={{ background: "var(--gradient-cta)" }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

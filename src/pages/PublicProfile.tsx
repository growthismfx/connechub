import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, MapPin, Globe, Music2, Link as LinkIcon, Instagram, Twitter, Github, Youtube, Linkedin } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const SOCIAL_ICONS: Record<string, any> = { instagram: Instagram, twitter: Twitter, github: Github, youtube: Youtube, linkedin: Linkedin, tiktok: Music2 };

export default function PublicProfile() {
  const { username } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username!).maybeSingle();
      setP(data); setLoading(false);
    })();
  }, [username]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!p) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p>Profile not found</p><Button onClick={() => nav("/chats")} variant="outline" className="rounded-full">Go home</Button></div>;

  const social: Record<string, string> = p.social_links || {};
  const links: { label: string; url: string }[] = p.links || [];
  const isMe = user?.id === p.id;

  return (
    <div className="min-h-screen pb-32">
      <div className="relative h-48" style={{ background: p.banner_url ? `url(${p.banner_url}) center/cover` : "var(--gradient-cta)" }}>
        <button onClick={() => nav(-1)} className="absolute top-10 left-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
      </div>

      <div className="px-5 -mt-14">
        <Avatar className="w-28 h-28 ring-4 ring-background">
          <AvatarImage src={p.avatar_url || undefined} />
          <AvatarFallback className="text-3xl">{p.name?.[0]}</AvatarFallback>
        </Avatar>

        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{p.name}</h1>
            {p.pronouns && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p.pronouns}</span>}
            {(p.badges || []).map((b: string) => <span key={b} className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ background: "var(--gradient-cta)" }}>{b}</span>)}
          </div>
          <p className="text-sm text-muted-foreground">@{p.username}</p>
          {p.bio && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{p.bio}</p>}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
            {p.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location}</span>}
            {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground"><Globe className="w-3 h-3" />{p.website.replace(/^https?:\/\//, "")}</a>}
          </div>

          {/* Social */}
          {Object.entries(social).some(([, v]) => v) && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {Object.entries(social).filter(([, v]) => v).map(([k, v]) => {
                const Icon = SOCIAL_ICONS[k] || LinkIcon;
                return <a key={k} href={v.startsWith("http") ? v : `https://${v}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:scale-105 transition-transform"><Icon className="w-4 h-4" /></a>;
              })}
            </div>
          )}

          {/* Custom links */}
          {links.length > 0 && (
            <div className="space-y-2 mt-4">
              {links.filter((l) => l.url).map((l, i) => (
                <a key={i} href={l.url.startsWith("http") ? l.url : `https://${l.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-muted hover:bg-muted/70 transition-colors">
                  <LinkIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">{l.label || l.url}</span>
                </a>
              ))}
            </div>
          )}

          {p.profile_music_url && (
            <div className="mt-4 p-3 rounded-2xl flex items-center gap-3" style={{ background: "var(--gradient-card)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-cta)" }}><Music2 className="w-4 h-4 text-white" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.profile_music_title || "Now playing"}</p>
                <a href={p.profile_music_url} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground truncate block">Play →</a>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {isMe ? (
              <Button asChild className="flex-1 rounded-full h-11 text-white border-0" style={{ background: "var(--gradient-cta)" }}>
                <Link to="/settings/profile">Edit profile</Link>
              </Button>
            ) : (
              <Button onClick={() => nav(`/chat/new/${p.id}`)} className="flex-1 rounded-full h-11 text-white border-0" style={{ background: "var(--gradient-cta)" }}>
                <MessageCircle className="w-4 h-4 mr-2" /> Message
              </Button>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

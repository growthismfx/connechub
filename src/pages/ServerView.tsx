import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Hash, Volume2, Send, Settings, Users, Copy, LogOut, Plus, Mic, MicOff, PhoneOff,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type Channel = { id: string; name: string; type: "text" | "voice" | "announcement"; topic: string | null; position: number };
type Server = { id: string; name: string; description: string | null; icon_url: string | null; banner_url: string | null; invite_code: string; owner_id: string; is_public: boolean; member_count: number };
type Msg = { id: string; content: string | null; author_id: string; created_at: string; deleted_at: string | null; edited_at: string | null };
type Member = { user_id: string; nickname: string | null; profile?: { name: string | null; avatar_url: string | null; username: string | null } };
type VoiceP = { user_id: string; muted: boolean; deafened: boolean };

export default function ServerView() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeCh, setActiveCh] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [voice, setVoice] = useState<VoiceP[]>([]);
  const [voiceChId, setVoiceChId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState("");
  const [newChName, setNewChName] = useState("");
  const [newChType, setNewChType] = useState<"text" | "voice">("text");
  const [chOpen, setChOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isOwner = server?.owner_id === user?.id;

  const load = async () => {
    if (!id) return;
    const [{ data: s }, { data: chs }, { data: mems }] = await Promise.all([
      supabase.from("servers").select("*").eq("id", id).maybeSingle(),
      supabase.from("server_channels").select("*").eq("server_id", id).order("position"),
      supabase.from("server_members").select("user_id, nickname, profile:profiles!server_members_user_id_fkey(name, avatar_url, username)").eq("server_id", id),
    ]);
    if (!s) { toast.error("Server not found"); nav("/servers"); return; }
    setServer(s as any);
    setChannels((chs as any) || []);
    setMembers((mems as any) || []);
    const firstText = (chs as any || []).find((c: Channel) => c.type === "text");
    if (firstText && !activeCh) setActiveCh(firstText);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!activeCh || activeCh.type !== "text") return;
    supabase.from("channel_messages").select("*").eq("channel_id", activeCh.id).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(200).then(({ data }) => setMessages((data as any) || []));
    const ch = supabase.channel(`ch-${activeCh.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channel_messages", filter: `channel_id=eq.${activeCh.id}` },
        (p) => setMessages((prev) => [...prev, p.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCh?.id]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length]);

  // Voice presence
  useEffect(() => {
    if (!voiceChId) { setVoice([]); return; }
    const load = () => supabase.from("voice_participants").select("*").eq("channel_id", voiceChId)
      .then(({ data }) => setVoice((data as any) || []));
    load();
    const ch = supabase.channel(`voice-${voiceChId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_participants", filter: `channel_id=eq.${voiceChId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [voiceChId]);

  const send = async () => {
    if (!text.trim() || !activeCh || !user || !server) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("channel_messages").insert({
      channel_id: activeCh.id, server_id: server.id, author_id: user.id, content: body,
    });
    if (error) toast.error(error.message);
  };

  const joinVoice = async (ch: Channel) => {
    if (!user || !server) return;
    if (voiceChId) await supabase.from("voice_participants").delete().eq("user_id", user.id).eq("channel_id", voiceChId);
    const { error } = await supabase.from("voice_participants").insert({
      channel_id: ch.id, server_id: server.id, user_id: user.id,
    });
    if (error) return toast.error(error.message);
    setVoiceChId(ch.id);
    toast.success(`Joined ${ch.name}`);
  };

  const leaveVoice = async () => {
    if (!user || !voiceChId) return;
    await supabase.from("voice_participants").delete().eq("user_id", user.id).eq("channel_id", voiceChId);
    setVoiceChId(null);
  };

  const toggleMute = async () => {
    if (!user || !voiceChId) return;
    const next = !muted;
    setMuted(next);
    await supabase.from("voice_participants").update({ muted: next }).eq("user_id", user.id).eq("channel_id", voiceChId);
  };

  const createChannel = async () => {
    if (!newChName.trim() || !server) return;
    const { error } = await supabase.from("server_channels").insert({
      server_id: server.id, name: newChName.trim().toLowerCase().replace(/\s+/g, "-"),
      type: newChType, position: channels.length,
    });
    if (error) return toast.error(error.message);
    setNewChName(""); setChOpen(false); load();
  };

  const copyInvite = () => {
    if (!server) return;
    navigator.clipboard.writeText(server.invite_code);
    toast.success("Invite code copied");
  };

  const leaveServer = async () => {
    if (!user || !server || isOwner) return;
    await supabase.from("server_members").delete().eq("server_id", server.id).eq("user_id", user.id);
    nav("/servers");
  };

  if (!server) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const memberById = (uid: string) => members.find((m) => m.user_id === uid);

  const Sidebar = (
    <div className="w-full h-full flex flex-col bg-muted/30">
      <div className="p-3 border-b">
        <div className="font-bold truncate">{server.name}</div>
        <div className="text-xs text-muted-foreground">{server.member_count} members</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="flex items-center justify-between px-2 py-1 text-xs uppercase text-muted-foreground">
          <span>Channels</span>
          {isOwner && (
            <Dialog open={chOpen} onOpenChange={setChOpen}>
              <DialogTrigger asChild><button><Plus className="w-3 h-3" /></button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Channel</DialogTitle></DialogHeader>
                <div className="flex gap-2">
                  <Button size="sm" variant={newChType === "text" ? "default" : "secondary"} onClick={() => setNewChType("text")}>Text</Button>
                  <Button size="sm" variant={newChType === "voice" ? "default" : "secondary"} onClick={() => setNewChType("voice")}>Voice</Button>
                </div>
                <Input placeholder="channel-name" value={newChName} onChange={(e) => setNewChName(e.target.value)} />
                <Button onClick={createChannel}>Create</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {channels.map((c) => c.type === "text" ? (
          <button key={c.id} onClick={() => setActiveCh(c)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${activeCh?.id === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
            <Hash className="w-4 h-4" /> {c.name}
          </button>
        ) : (
          <div key={c.id}>
            <button onClick={() => joinVoice(c)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${voiceChId === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
              <Volume2 className="w-4 h-4" /> {c.name}
            </button>
            {voiceChId === c.id && voice.length > 0 && (
              <div className="pl-8 py-1 space-y-1">
                {voice.map((v) => {
                  const m = memberById(v.user_id);
                  return (
                    <div key={v.user_id} className="text-xs flex items-center gap-1 text-muted-foreground">
                      {v.muted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-green-500" />}
                      {m?.profile?.name || m?.profile?.username || "User"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t space-y-1">
        <Button size="sm" variant="ghost" className="w-full justify-start" onClick={copyInvite}>
          <Copy className="w-4 h-4 mr-2" />Invite: {server.invite_code}
        </Button>
        {!isOwner && (
          <Button size="sm" variant="ghost" className="w-full justify-start text-destructive" onClick={leaveServer}>
            <LogOut className="w-4 h-4 mr-2" />Leave server
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 border-r">{Sidebar}</aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b p-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/servers")}><ArrowLeft className="w-5 h-5" /></Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden"><Hash className="w-4 h-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">{Sidebar}</SheetContent>
          </Sheet>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold truncate">{activeCh?.name || "select a channel"}</span>
            {activeCh?.topic && <span className="text-sm text-muted-foreground truncate">— {activeCh.topic}</span>}
          </div>
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon"><Users className="w-5 h-5" /></Button></SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="font-semibold mb-3">Members ({members.length})</div>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                      {m.profile?.avatar_url && <img src={m.profile.avatar_url} className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-sm">{m.nickname || m.profile?.name || m.profile?.username || "User"}</div>
                    {m.user_id === server.owner_id && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Owner</span>}
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {activeCh?.type === "text" ? (
          <>
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const mm = memberById(m.author_id);
                const own = m.author_id === user?.id;
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                      {mm?.profile?.avatar_url && <img src={mm.profile.avatar_url} className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <span className={own ? "text-primary" : ""}>{mm?.nickname || mm?.profile?.name || "User"}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="text-sm break-words whitespace-pre-wrap">{m.content}</div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-16">
                  <Hash className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <p>Welcome to #{activeCh.name}</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t flex gap-2 items-center">
              <Input placeholder={`Message #${activeCh.name}`} value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} />
              <Button size="icon" onClick={send}><Send className="w-4 h-4" /></Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a text channel to chat
          </div>
        )}

        {voiceChId && (
          <div className="border-t bg-muted/40 p-2 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-green-500" />
            <div className="flex-1 text-sm">
              Voice · {channels.find((c) => c.id === voiceChId)?.name} · {voice.length} connected
            </div>
            <Button size="icon" variant="ghost" onClick={toggleMute}>
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="destructive" onClick={leaveVoice}><PhoneOff className="w-4 h-4" /></Button>
          </div>
        )}
      </main>
    </div>
  );
}

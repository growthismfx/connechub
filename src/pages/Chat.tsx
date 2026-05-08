import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createOrGetActiveCall } from "@/lib/callHelpers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Mic, Paperclip, Send, Phone, Video, Check, CheckCheck, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [other, setOther] = useState<any>(null);
  const [connectedVia, setConnectedVia] = useState<"username" | "phone">("username");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const stopTypingRef = useRef<number | null>(null);

  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id, connected_via")
        .eq("conversation_id", id);
      const me = parts?.find((p: any) => p.user_id === user.id);
      const otherP = parts?.find((p: any) => p.user_id !== user.id);
      if (me?.connected_via) setConnectedVia(me.connected_via as any);
      if (otherP) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", otherP.user_id).maybeSingle();
        setOther(prof);
        setIsSelf(false);
      } else {
        // Self-chat: only one participant (me)
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        setOther({ ...(prof || {}), name: "You (Message yourself)" });
        setIsSelf(true);
      }
    })();
  }, [id, user]);

  // Subscribe to other user's profile updates (online/last_seen)
  useEffect(() => {
    if (!other?.id) return;
    const ch = supabase.channel(`profile-${other.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${other.id}` },
        (p) => setOther((prev: any) => ({ ...prev, ...p.new })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [other?.id]);

  // Load messages + realtime updates
  useEffect(() => {
    if (!id || !user) return;
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").then(async ({ data }) => {
      const list = data || [];
      setMessages(list);
      // Mark incoming undelivered as delivered, then as read
      const incoming = list.filter((m: any) => m.sender_id !== user.id);
      const toDeliver = incoming.filter((m: any) => !m.delivered_at).map((m: any) => m.id);
      const toRead = incoming.filter((m: any) => !m.read_at).map((m: any) => m.id);
      const now = new Date().toISOString();
      if (toDeliver.length) await supabase.from("messages").update({ delivered_at: now }).in("id", toDeliver);
      if (toRead.length) await supabase.from("messages").update({ read_at: now, status: "read" }).in("id", toRead);
    });

    const ch = supabase.channel(`msgs-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (p) => {
          const m: any = p.new;
          setMessages((prev) => prev.find((x) => x.id === m.id) ? prev : [...prev, m]);
          if (m.sender_id !== user.id) {
            const now = new Date().toISOString();
            await supabase.from("messages").update({ delivered_at: now, read_at: now, status: "read" }).eq("id", m.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (p) => setMessages((prev) => prev.map((m) => m.id === (p.new as any).id ? { ...m, ...(p.new as any) } : m)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  // Typing presence channel (broadcast)
  useEffect(() => {
    if (!id || !user) return;
    const ch = supabase.channel(`typing-${id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (msg: any) => {
        if (msg.payload?.userId === user.id) return;
        setOtherTyping(!!msg.payload?.typing);
        if (stopTypingRef.current) window.clearTimeout(stopTypingRef.current);
        if (msg.payload?.typing) {
          stopTypingRef.current = window.setTimeout(() => setOtherTyping(false), 3500);
        }
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [id, user]);

  const sendTyping = (typing: boolean) => {
    const now = Date.now();
    if (typing && now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: user?.id, typing } });
  };

  const onTextChange = (v: string) => {
    setText(v);
    sendTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => sendTyping(false), 2000);
  };

  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // First load: jump instantly to bottom; afterwards smooth-scroll on new messages
    if (!didInitialScrollRef.current && messages.length) {
      el.scrollTop = el.scrollHeight;
      didInitialScrollRef.current = true;
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, otherTyping]);

  // Reset initial-scroll flag when switching conversations
  useEffect(() => { didInitialScrollRef.current = false; }, [id]);

  const send = async () => {
    if (!text.trim() || !id || !user || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    sendTyping(false);
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, content });
    if (error) toast.error(error.message);
    setSending(false);
  };

  const uploadFile = async (file: File) => {
    if (!user || !id) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
    await supabase.from("messages").insert({
      conversation_id: id, sender_id: user.id, message_type: type,
      content: file.name, media_url: data?.signedUrl,
    });
  };

  const startCall = async (call_type: "voice" | "video") => {
    if (!user || !other) return;
    const { data, error } = await createOrGetActiveCall({ callerId: user.id, calleeId: other.id, callType: call_type });
    if (error || !data) return toast.error(error?.message || "Failed to start call");
    nav(`/call/${data.id}?role=caller`);
  };

  const presenceLabel = useMemo(() => {
    if (!other) return "";
    if (otherTyping) return "typing…";
    if (other.is_online) return "online";
    if (other.show_last_seen && other.last_seen) {
      return `last seen ${formatDistanceToNow(new Date(other.last_seen), { addSuffix: true })}`;
    }
    return connectedVia === "phone"
      ? `${other.country_code || ""}${other.assigned_number || ""}${other.username ? ` · @${other.username}` : ""}`
      : `@${other.username || ""}`;
  }, [other, otherTyping, connectedVia]);

  const renderTicks = (m: any) => {
    if (m.read_at) return <CheckCheck className="w-3.5 h-3.5 inline" style={{ color: "hsl(210 100% 55%)" }} />;
    if (m.delivered_at) return <CheckCheck className="w-3.5 h-3.5 inline text-muted-foreground" />;
    return <Check className="w-3.5 h-3.5 inline text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/chats")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={other?.avatar_url || undefined} />
              <AvatarFallback>{other?.name?.[0]}</AvatarFallback>
            </Avatar>
            {other?.is_online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background animate-pulse" style={{ background: "hsl(var(--online, 142 71% 45%))" }} />
            )}
          </div>
          <div>
            <h2 className="font-bold leading-tight">{other?.name || "Chat"}</h2>
            <p className={`text-xs ${otherTyping ? "text-primary" : "text-muted-foreground"} transition-colors`}>
              {presenceLabel}
            </p>
          </div>
        </div>
        {!isSelf && (
          <div className="flex gap-2">
            <button onClick={() => startCall("voice")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </button>
            <button onClick={() => startCall("video")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
              <Video className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-28">
        {messages.map((m) => {
          const me = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${me ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className="max-w-[75%]">
                <div className={`px-4 py-3 rounded-3xl ${me ? "bubble-me text-foreground" : "bg-[hsl(var(--bubble-them))] text-foreground"}`}>
                  {m.message_type === "call" ? (
                    <p className="text-sm flex items-center gap-2">
                      {(m.content || "").toLowerCase().includes("missed") ? (
                        <PhoneMissed className="w-4 h-4 text-destructive" />
                      ) : me ? (
                        <PhoneOutgoing className="w-4 h-4" />
                      ) : (
                        <PhoneIncoming className="w-4 h-4" />
                      )}
                      <span>{m.content}</span>
                    </p>
                  ) : m.message_type === "image" && m.media_url ? (
                    <img src={m.media_url} alt="" className="rounded-2xl max-w-full" />
                  ) : m.message_type === "video" && m.media_url ? (
                    <video src={m.media_url} controls className="rounded-2xl max-w-full" />
                  ) : m.message_type === "audio" && m.media_url ? (
                    <audio src={m.media_url} controls />
                  ) : m.message_type === "file" && m.media_url ? (
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="underline">{m.content}</a>
                  ) : (
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  )}
                </div>
                <p className={`text-xs text-muted-foreground mt-1 flex items-center gap-1 ${me ? "justify-end" : ""}`}>
                  <span>{format(new Date(m.created_at), "HH:mm")}</span>
                  {me && renderTicks(m)}
                </p>
              </div>
            </div>
          );
        })}

        {otherTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="px-4 py-3 rounded-3xl bg-[hsl(var(--bubble-them))] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-0 right-0 px-5">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white rounded-full pl-4 pr-2 h-14 shadow-[var(--shadow-pill)]">
            <button onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </button>
            <input
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your message..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button><Mic className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <button onClick={send} className="w-14 h-14 rounded-full flex items-center justify-center shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
            <Send className="w-5 h-5 text-foreground" />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,application/*" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
      </div>
    </div>
  );
}

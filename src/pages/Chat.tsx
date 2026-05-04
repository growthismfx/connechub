import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Mic, Paperclip, Send, Phone, Video } from "lucide-react";
import { format } from "date-fns";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      }
    })();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").then(({ data }) => {
      setMessages(data || []);
    });
    const ch = supabase.channel(`msgs-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (p) => setMessages((prev) => [...prev, p.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !id || !user || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
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
    const { data, error } = await supabase
      .from("calls")
      .insert({ caller_id: user.id, callee_id: other.id, call_type, status: "ringing" })
      .select()
      .single();
    if (error || !data) return toast.error(error?.message || "Failed to start call");
    nav(`/call/${data.id}?role=caller`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/chats")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={other?.avatar_url || undefined} />
            <AvatarFallback>{other?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-bold leading-tight">{other?.name || "Chat"}</h2>
            <p className="text-xs text-muted-foreground">
              {other?.is_online
                ? "online"
                : connectedVia === "phone"
                  ? `${other?.country_code || ""}${other?.assigned_number || ""}${other?.username ? ` · @${other.username}` : ""}`
                  : `@${other?.username || ""}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => startCall("voice")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <Phone className="w-4 h-4" />
          </button>
          <button onClick={() => startCall("video")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-28">
        {messages.map((m) => {
          const me = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${me ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%]">
                <div className={`px-4 py-3 rounded-3xl ${me ? "bubble-me text-foreground" : "bg-[hsl(var(--bubble-them))] text-foreground"}`}>
                  {m.message_type === "image" && m.media_url ? (
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
                <p className={`text-xs text-muted-foreground mt-1 ${me ? "text-right" : ""}`}>
                  {format(new Date(m.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-4 left-0 right-0 px-5">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white rounded-full pl-4 pr-2 h-14 shadow-[var(--shadow-pill)]">
            <button onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
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

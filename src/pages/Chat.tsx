import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createOrGetActiveCall } from "@/lib/callHelpers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Mic, Paperclip, Send, Phone, Video, Check, CheckCheck, PhoneIncoming, PhoneOutgoing, PhoneMissed, Star, Users } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import ProfileSheet from "@/components/ProfileSheet";
import { decryptMessage } from "@/lib/e2ee";
import MessageActionSheet, { MessageActionTarget } from "@/components/MessageActionSheet";
import { Pin as PinIcon, X } from "lucide-react";

export default function Chat() {
  const { id } = useParams();
  const { user, profile } = useAuth();
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
  const [isGroup, setIsGroup] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ name: string; avatar_url: string | null; memberCount: number } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [actionTarget, setActionTarget] = useState<MessageActionTarget | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const longPressRef = useRef<number | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ type: "image" | "video"; url: string } | null>(null);

  // Load my starred ids
  useEffect(() => {
    if (!user) return;
    supabase.from("starred_messages").select("message_id").eq("user_id", user.id).then(({ data }) => {
      setStarred(new Set((data || []).map((s: any) => s.message_id)));
    });
  }, [user]);

  const toggleStar = async (mid: string) => {
    if (!user) return;
    if (starred.has(mid)) {
      await supabase.from("starred_messages").delete().eq("user_id", user.id).eq("message_id", mid);
      const next = new Set(starred); next.delete(mid); setStarred(next);
    } else {
      await supabase.from("starred_messages").insert({ user_id: user.id, message_id: mid });
      setStarred(new Set([...starred, mid]));
    }
  };

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, is_group, name, avatar_url")
        .eq("id", id)
        .maybeSingle();
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id, connected_via")
        .eq("conversation_id", id);
      setParticipantIds((parts || []).map((p: any) => p.user_id));
      const me = parts?.find((p: any) => p.user_id === user.id);
      if (me?.connected_via) setConnectedVia(me.connected_via as any);

      if (conv?.is_group) {
        setIsGroup(true);
        setIsSelf(false);
        setGroupInfo({ name: conv.name || "Group", avatar_url: conv.avatar_url, memberCount: parts?.length || 0 });
        setOther({ name: conv.name || "Group", avatar_url: conv.avatar_url });
        return;
      }

      const otherP = parts?.find((p: any) => p.user_id !== user.id);
      if (otherP) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", otherP.user_id).maybeSingle();
        setOther(prof);
        setIsSelf(false);
      } else {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        setOther({ ...(prof || {}), name: "You (Message yourself)" });
        setIsSelf(true);
      }
    })();
  }, [id, user]);

  // Build sender→name map for group chats
  const [senderMap, setSenderMap] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  useEffect(() => {
    if (!isGroup || !id) return;
    (async () => {
      const { data: parts } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", id);
      const ids = (parts || []).map((p: any) => p.user_id);
      if (!ids.length) return;
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
      const m: Record<string, any> = {};
      (profs || []).forEach((p: any) => { m[p.id] = { name: p.name, avatar_url: p.avatar_url }; });
      setSenderMap(m);
    })();
  }, [isGroup, id]);


  // Subscribe to other user's profile updates (online/last_seen)
  useEffect(() => {
    if (!other?.id) return;
    const ch = supabase.channel(`profile-${other.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${other.id}` },
        (p) => setOther((prev: any) => ({ ...prev, ...p.new })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [other?.id]);

  // Helper: decrypt a single message in place
  const decryptIfNeeded = async (m: any) => {
    if (!m?.is_encrypted || !user) return m;
    const pt = await decryptMessage(user.id, m.content, m.iv, m.encrypted_keys || {});
    return { ...m, content: pt ?? "Message unavailable on this device" };
  };

  // Load messages + realtime updates
  useEffect(() => {
    if (!id || !user) return;
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").then(async ({ data }) => {
      const list = data || [];
      const decrypted = await Promise.all(list.map(decryptIfNeeded));
      setMessages(decrypted);
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
          const raw: any = p.new;
          const m = await decryptIfNeeded(raw);
          setMessages((prev) => prev.find((x) => x.id === m.id) ? prev : [...prev, m]);
          if (m.sender_id !== user.id) {
            const now = new Date().toISOString();
            await supabase.from("messages").update({ delivered_at: now, read_at: now, status: "read" }).eq("id", m.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (p) => {
          const raw: any = p.new;
          const m = await decryptIfNeeded(raw);
          setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, ...m } : x));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => loadReactions())
      .on("postgres_changes", { event: "*", schema: "public", table: "message_pins", filter: `conversation_id=eq.${id}` }, () => loadPins())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  const loadReactions = async () => {
    if (!id || !user) return;
    const { data: msgs } = await supabase.from("messages").select("id").eq("conversation_id", id);
    const ids = (msgs || []).map((m: any) => m.id);
    if (!ids.length) return setReactions({});
    const { data } = await supabase.from("message_reactions" as any).select("message_id, user_id, emoji").in("message_id", ids);
    const grouped: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    (data || []).forEach((r: any) => {
      grouped[r.message_id] = grouped[r.message_id] || {};
      const cur = grouped[r.message_id][r.emoji] || { count: 0, mine: false };
      cur.count += 1;
      if (r.user_id === user.id) cur.mine = true;
      grouped[r.message_id][r.emoji] = cur;
    });
    const out: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
    Object.keys(grouped).forEach((mid) => {
      out[mid] = Object.entries(grouped[mid]).map(([emoji, v]) => ({ emoji, ...v }));
    });
    setReactions(out);
  };
  const loadPins = async () => {
    if (!id) return;
    const { data } = await supabase.from("message_pins" as any).select("message_id").eq("conversation_id", id);
    setPinnedIds(new Set((data || []).map((p: any) => p.message_id)));
  };
  useEffect(() => { loadReactions(); loadPins(); }, [id, user]);




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

    // Editing an existing message (plaintext only; keeps E2EE for new sends)
    if (editing) {
      const history = Array.isArray(editing.edit_history) ? editing.edit_history : [];
      history.push({ content: editing.content, at: new Date().toISOString() });
      const { error } = await supabase.from("messages").update({
        content,
        is_encrypted: false,
        iv: null,
        encrypted_keys: null,
        edited_at: new Date().toISOString(),
        edit_history: history,
      } as any).eq("id", editing.id);
      if (error) toast.error(error.message);
      setEditing(null);
      setSending(false);
      return;
    }

    // Messages are stored in plaintext so they stay readable on every device
    // and chat previews never show ciphertext.
    const payload: any = { conversation_id: id, sender_id: user.id, content };

    if (replyTo?.id) payload.reply_to = replyTo.id;
    const { error } = await supabase.from("messages").insert(payload);
    if (error) toast.error(error.message);
    setReplyTo(null);
    setSending(false);
  };

  const openActions = (m: any) => {
    if (m.message_type === "call" || m.deleted_for_everyone) return;
    setActionTarget({
      id: m.id,
      content: m.content || "",
      sender_id: m.sender_id,
      message_type: m.message_type,
      deleted_for_everyone: m.deleted_for_everyone,
      isMine: m.sender_id === user?.id,
    });
  };

  const startLongPress = (m: any) => {
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    longPressRef.current = window.setTimeout(() => openActions(m), 450);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
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
    if (isGroup && groupInfo) return `${groupInfo.memberCount} members${otherTyping ? " · someone typing…" : ""}`;
    if (!other) return "";
    if (otherTyping) return "typing…";
    if (other.is_online) return "online";
    if (other.show_last_seen && other.last_seen) {
      return `last seen ${formatDistanceToNow(new Date(other.last_seen), { addSuffix: true })}`;
    }
    return connectedVia === "phone"
      ? `${other.country_code || ""}${other.assigned_number || ""}${other.username ? ` · @${other.username}` : ""}`
      : `@${other.username || ""}`;
  }, [other, otherTyping, connectedVia, isGroup, groupInfo]);

  const renderTicks = (m: any) => {
    if (m.read_at) return <CheckCheck className="w-3.5 h-3.5 inline" style={{ color: "hsl(210 100% 55%)" }} />;
    if (m.delivered_at) return <CheckCheck className="w-3.5 h-3.5 inline text-muted-foreground" />;
    return <Check className="w-3.5 h-3.5 inline text-muted-foreground" />;
  };

  const wallpaper = (profile as any)?.wallpaper_url;
  return (
    <div className="min-h-screen flex flex-col relative">
      {wallpaper && (
        <div className="fixed inset-0 pointer-events-none z-0" style={{ background: wallpaper.startsWith("http") ? `url(${wallpaper}) center/cover` : wallpaper, opacity: 0.5 }} />
      )}
      <div className="relative z-[1] flex flex-col flex-1 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav("/chats")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={() => { if (isGroup) nav(`/group/${id}/settings`); else if (!isSelf) setProfileOpen(true); }} className="flex items-center gap-3 min-w-0 text-left">
            <div className="relative shrink-0">
              <Avatar className="w-10 h-10">
                <AvatarImage src={other?.avatar_url || undefined} />
                <AvatarFallback>{other?.name?.[0]}</AvatarFallback>
              </Avatar>
              {!isGroup && other?.is_online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background animate-pulse" style={{ background: "hsl(var(--online, 142 71% 45%))" }} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold leading-tight truncate">{other?.name || "Chat"}</h2>
              <p className={`text-xs ${otherTyping ? "text-primary" : "text-muted-foreground"} transition-colors truncate`}>
                {presenceLabel}
              </p>
            </div>
          </button>
        </div>
        {!isSelf && !isGroup && (
          <div className="flex gap-2">
            <button onClick={() => startCall("voice")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </button>
            <button onClick={() => startCall("video")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
              <Video className="w-4 h-4" />
            </button>
          </div>
        )}
        {isGroup && (
          <button onClick={() => nav(`/group/${id}/settings`)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center" aria-label="Group settings">
            <Users className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pinned banner */}
      {pinnedIds.size > 0 && (() => {
        const pm = messages.find((x) => pinnedIds.has(x.id));
        if (!pm) return null;
        return (
          <div className="mx-5 mb-1 flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-3 py-2 shadow-[var(--shadow-pill)] border border-border/40">
            <PinIcon className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
            <p className="text-xs truncate flex-1"><span className="font-semibold">Pinned · </span>{pm.deleted_for_everyone ? "deleted message" : (pm.content || pm.message_type)}</p>
          </div>
        );
      })()}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-28">
        {messages.map((m) => {
          const me = m.sender_id === user?.id;
          const reacts = reactions[m.id] || [];
          const replyMsg = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
          const deleted = m.deleted_for_everyone;
          return (
            <div key={m.id} className={`group flex gap-2 ${me ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className="max-w-[75%] relative">
                <div
                  onContextMenu={(e) => { e.preventDefault(); openActions(m); }}
                  onTouchStart={() => startLongPress(m)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  onDoubleClick={() => openActions(m)}
                  className={`px-4 py-3 rounded-3xl select-none ${me ? "bubble-me text-foreground" : "bg-[hsl(var(--bubble-them))] text-foreground"} ${deleted ? "italic opacity-70" : ""}`}
                >
                  {isGroup && !me && !deleted && (
                    <p className="text-[11px] font-semibold mb-1" style={{ color: "hsl(var(--primary))" }}>
                      {senderMap[m.sender_id]?.name || "Member"}
                    </p>
                  )}
                  {replyMsg && !deleted && (
                    <div className="mb-2 pl-2 border-l-2 rounded-md bg-black/5 px-2 py-1" style={{ borderColor: "hsl(var(--primary))" }}>
                      <p className="text-[10px] font-semibold opacity-80">{senderMap[replyMsg.sender_id]?.name || (replyMsg.sender_id === user?.id ? "You" : "Reply")}</p>
                      <p className="text-[11px] truncate opacity-80">{replyMsg.deleted_for_everyone ? "deleted message" : (replyMsg.content || replyMsg.message_type)}</p>
                    </div>
                  )}
                  {deleted ? (
                    <p className="text-sm">🚫 This message was deleted</p>
                  ) : m.message_type === "call" ? (
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
                    <button type="button" onClick={() => setMediaViewer({ type: "image", url: m.media_url })} className="block">
                      <img src={m.media_url} alt="" className="rounded-2xl max-w-full cursor-zoom-in" />
                    </button>
                  ) : m.message_type === "video" && m.media_url ? (
                    <button type="button" onClick={() => setMediaViewer({ type: "video", url: m.media_url })} className="block w-full">
                      <video src={m.media_url} className="rounded-2xl max-w-full cursor-zoom-in" />
                    </button>
                  ) : m.message_type === "audio" && m.media_url ? (
                    <audio src={m.media_url} controls className="w-full" />
                  ) : m.message_type === "file" && m.media_url ? (
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="underline">{m.content}</a>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                </div>
                {reacts.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${me ? "justify-end" : "justify-start"}`}>
                    {reacts.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => { setActionTarget({ id: m.id, content: m.content || "", sender_id: m.sender_id, message_type: m.message_type, isMine: me }); }}
                        className={`text-[11px] leading-none px-2 py-0.5 rounded-full border ${r.mine ? "bg-primary/10 border-primary/40" : "bg-white border-border/50"} shadow-sm`}
                      >
                        <span className="mr-0.5">{r.emoji}</span>
                        <span className="text-muted-foreground">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className={`text-xs text-muted-foreground mt-1 flex items-center gap-1 ${me ? "justify-end" : ""}`}>
                  {pinnedIds.has(m.id) && <PinIcon className="w-3 h-3" />}
                  {starred.has(m.id) && <Star className="w-3 h-3 fill-current text-yellow-500" />}
                  {m.edited_at && !deleted && <span className="italic">edited</span>}
                  <span>{format(new Date(m.created_at), "HH:mm")}</span>
                  {me && renderTicks(m)}
                </p>
                <button
                  onClick={() => openActions(m)}
                  className={`absolute -top-2 ${me ? "-left-7" : "-right-7"} w-6 h-6 rounded-full bg-white shadow-[var(--shadow-pill)] items-center justify-center hidden group-hover:flex`}
                  aria-label="Message actions"
                >
                  <span className="text-[10px]">⋯</span>
                </button>
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
        {(replyTo || editing) && (
          <div className="mb-2 flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-[var(--shadow-pill)] border border-border/40 animate-fade-in">
            <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-cta)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
                {editing ? "Editing message" : `Replying to ${senderMap[replyTo?.sender_id]?.name || (replyTo?.sender_id === user?.id ? "yourself" : other?.name || "message")}`}
              </p>
              <p className="text-xs text-muted-foreground truncate">{(editing || replyTo)?.content}</p>
            </div>
            <button onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setText(""); } }} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white rounded-full pl-4 pr-2 h-14 shadow-[var(--shadow-pill)]">
            <button onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </button>
            <input
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={editing ? "Edit your message…" : "Type your message..."}
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
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} other={other} conversationId={id} onCall={(t) => { setProfileOpen(false); startCall(t); }} />
      <MessageActionSheet
        open={!!actionTarget}
        target={actionTarget}
        userId={user?.id}
        isStarred={actionTarget ? starred.has(actionTarget.id) : false}
        isPinned={actionTarget ? pinnedIds.has(actionTarget.id) : false}
        onClose={() => setActionTarget(null)}
        onReply={(m) => { const full = messages.find((x) => x.id === m.id); setReplyTo(full || m); setEditing(null); }}
        onEdit={(m) => { const full = messages.find((x) => x.id === m.id); setEditing(full || m); setReplyTo(null); setText((full || m).content || ""); }}
        onPinned={() => { loadPins(); }}
        onDeleted={() => {}}
        onStarToggle={() => { if (actionTarget) toggleStar(actionTarget.id); }}
      />
      {mediaViewer && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setMediaViewer(null)}
        >
          <button
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center backdrop-blur"
            onClick={(e) => { e.stopPropagation(); setMediaViewer(null); }}
          >
            <X className="w-5 h-5" />
          </button>
          {mediaViewer.type === "image" ? (
            <img
              src={mediaViewer.url}
              alt=""
              className="max-w-[95vw] max-h-[95vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={mediaViewer.url}
              controls
              autoPlay
              playsInline
              className="max-w-[95vw] max-h-[95vh]"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
      </div>
    </div>
  );
}

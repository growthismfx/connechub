import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { showBrowserNotification } from "@/lib/browserNotifications";

export default function BrowserNotificationListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const seenCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const messageChannel = supabase
      .channel(`browser-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const message: any = payload.new;
          if (!message?.id || seenMessagesRef.current.has(message.id)) return;
          if (message.sender_id === user.id) return;

          const { data: participant } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("conversation_id", message.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!participant) return;
          seenMessagesRef.current.add(message.id);
          if (location.pathname === `/chat/${message.conversation_id}` && document.visibilityState === "visible") return;

          const { data: sender } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", message.sender_id)
            .maybeSingle();

          const senderName = sender?.name || (sender?.username ? `@${sender.username}` : "New message");
          const body = message.message_type && message.message_type !== "text"
            ? `${senderName} sent ${message.message_type}`
            : message.content || "You have a new message";

          showBrowserNotification({
            title: senderName,
            body,
            tag: `message-${message.id}`,
            onClick: () => navigate(`/chat/${message.conversation_id}`),
          });
        }
      )
      .subscribe();

    const callChannel = supabase
      .channel(`browser-calls-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        async (payload) => {
          const call: any = payload.new;
          if (!call?.id || seenCallsRef.current.has(call.id)) return;
          seenCallsRef.current.add(call.id);

          const { data: caller } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", call.caller_id)
            .maybeSingle();

          const callerName = caller?.name || (caller?.username ? `@${caller.username}` : "Incoming call");

          showBrowserNotification({
            title: call.call_type === "video" ? "Incoming video call" : "Incoming voice call",
            body: `${callerName} is calling you`,
            tag: `call-${call.id}`,
            onClick: () => navigate(`/call/${call.id}?role=callee`),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(callChannel);
    };
  }, [user, navigate, location.pathname]);

  return null;
}
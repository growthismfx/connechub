import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function StartChat() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const via = params.get("via") === "phone" ? "phone" : "username";
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!user || !userId) return;
    (async () => {
      const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
      const myIds = (mine || []).map((m) => m.conversation_id);
      if (myIds.length) {
        const { data: theirs } = await supabase.from("conversation_participants")
          .select("conversation_id").eq("user_id", userId).in("conversation_id", myIds);
        const existing = theirs?.[0]?.conversation_id;
        if (existing) return nav(`/chat/${existing}`, { replace: true });
      }
      const { data: conv, error } = await supabase.from("conversations").insert({ created_by: user.id, is_group: false }).select().single();
      if (error || !conv) { toast.error(error?.message || "Failed"); return nav("/chats"); }
      const { error: pErr } = await supabase.from("conversation_participants").insert([
        { conversation_id: conv.id, user_id: user.id, connected_via: via },
        { conversation_id: conv.id, user_id: userId, connected_via: via },
      ]);
      if (pErr) { toast.error(pErr.message); return nav("/chats"); }
      nav(`/chat/${conv.id}`, { replace: true });
    })();
  }, [user, userId, nav, via]);

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Opening chat...</div>;
}

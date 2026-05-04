import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Clock, Check } from "lucide-react";

export default function StartChat() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const via = params.get("via") === "phone" ? "phone" : "username";
  const { user } = useAuth();
  const nav = useNavigate();
  const [target, setTarget] = useState<any>(null);
  const [reqStatus, setReqStatus] = useState<"none" | "pending_out" | "pending_in" | "accepted" | "loading">("loading");

  // Open or create the conversation directly (used for phone or accepted username)
  const openChat = async () => {
    if (!user || !userId) return;
    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
    const myIds = (mine || []).map((m) => m.conversation_id);
    if (myIds.length) {
      const { data: theirs } = await supabase.from("conversation_participants")
        .select("conversation_id").eq("user_id", userId).in("conversation_id", myIds);
      const existing = theirs?.find((t: any) => myIds.includes(t.conversation_id))?.conversation_id;
      if (existing) return nav(`/chat/${existing}`, { replace: true });
    }
    const { data: conv, error } = await supabase.from("conversations").insert({ created_by: user.id, is_group: false }).select().single();
    if (error || !conv) { toast.error(error?.message || "Failed"); return nav("/chats"); }
    const { error: pErr } = await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: user.id, connected_via: via, role: "member" },
      { conversation_id: conv.id, user_id: userId, connected_via: via, role: "member" },
    ]);
    if (pErr) { toast.error(pErr.message); return nav("/chats"); }
    nav(`/chat/${conv.id}`, { replace: true });
  };

  useEffect(() => {
    if (!user || !userId) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setTarget(prof);

      if (via === "phone") return openChat();

      // Username flow: requires accepted friend request
      const { data: reqs } = await supabase
        .from("friend_requests").select("*")
        .or(`and(from_user.eq.${user.id},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${user.id})`);
      const accepted = reqs?.find((r: any) => r.status === "accepted");
      if (accepted) return openChat();
      const out = reqs?.find((r: any) => r.from_user === user.id && r.status === "pending");
      const inc = reqs?.find((r: any) => r.to_user === user.id && r.status === "pending");
      if (out) return setReqStatus("pending_out");
      if (inc) return setReqStatus("pending_in");
      setReqStatus("none");
    })();
  }, [user, userId, via]);

  const sendRequest = async () => {
    if (!user || !userId) return;
    const { error } = await supabase.from("friend_requests").insert({ from_user: user.id, to_user: userId });
    if (error) return toast.error(error.message);
    toast.success("Request sent");
    setReqStatus("pending_out");
  };

  const acceptRequest = async () => {
    if (!user || !userId) return;
    const { error } = await supabase.from("friend_requests")
      .update({ status: "accepted" }).eq("from_user", userId).eq("to_user", user.id);
    if (error) return toast.error(error.message);
    openChat();
  };

  if (via === "phone" || reqStatus === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Opening chat...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Avatar className="w-24 h-24 mb-4">
        <AvatarImage src={target?.avatar_url || undefined} />
        <AvatarFallback className="text-2xl">{target?.name?.[0]}</AvatarFallback>
      </Avatar>
      <h2 className="text-2xl font-bold">{target?.name}</h2>
      <p className="text-sm text-muted-foreground mb-6">@{target?.username}</p>

      {reqStatus === "none" && (
        <>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            You found this user via username. Send a chat request to start a conversation.
          </p>
          <Button onClick={sendRequest} className="rounded-full h-12 px-8 text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>
            Send chat request
          </Button>
        </>
      )}
      {reqStatus === "pending_out" && (
        <div className="flex items-center gap-2 px-5 py-3 bg-white rounded-full shadow-[var(--shadow-pill)]">
          <Clock className="w-4 h-4" /> <span className="text-sm">Request pending</span>
        </div>
      )}
      {reqStatus === "pending_in" && (
        <>
          <p className="text-sm text-muted-foreground mb-4">This user sent you a chat request.</p>
          <Button onClick={acceptRequest} className="rounded-full h-12 px-8 text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>
            <Check className="w-4 h-4 mr-2" /> Accept and chat
          </Button>
        </>
      )}
      <Button variant="ghost" onClick={() => nav("/chats")} className="mt-6 rounded-full">Back</Button>
    </div>
  );
}

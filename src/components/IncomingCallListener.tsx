import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Listens globally for incoming calls and routes to the call screen.
export default function IncomingCallListener() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`incoming-calls-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        (p) => {
          const call: any = p.new;
          if (seenRef.current.has(call.id)) return;
          seenRef.current.add(call.id);
          // Don't redirect if user is already on a call screen
          if (loc.pathname.startsWith("/call/")) return;
          nav(`/call/${call.id}?role=callee`);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, nav, loc.pathname]);

  return null;
}

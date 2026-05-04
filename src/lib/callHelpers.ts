import { supabase } from "@/integrations/supabase/client";

export const ACTIVE_CALL_STATUSES = ["calling", "ringing", "connected"];

export async function createOrGetActiveCall(params: {
  callerId: string;
  calleeId: string;
  callType: "voice" | "video";
}) {
  const { callerId, calleeId, callType } = params;

  const { data: existing, error: existingError } = await supabase
    .from("calls")
    .select("*")
    .or(`and(caller_id.eq.${callerId},callee_id.eq.${calleeId}),and(caller_id.eq.${calleeId},callee_id.eq.${callerId})`)
    .in("status", ACTIVE_CALL_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { data: null, error: existingError, reused: false };
  }

  if (existing) {
    return { data: existing, error: null, reused: true };
  }

  const { data, error } = await supabase
    .from("calls")
    .insert({ caller_id: callerId, callee_id: calleeId, call_type: callType, status: "calling" })
    .select()
    .single();

  return { data, error, reused: false };
}
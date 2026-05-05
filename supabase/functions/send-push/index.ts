// @ts-nocheck
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendToUser(userId: string, payload: Record<string, unknown>) {
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (error || !subs?.length) return { sent: 0 };

  let sent = 0;
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: any) {
        console.error("[send-push] error", err?.statusCode, err?.body);
        const shouldDeleteSubscription =
          err?.statusCode === 404 ||
          err?.statusCode === 410 ||
          err?.statusCode === 403;

        if (shouldDeleteSubscription) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return { sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, record } = body;

    if (type === "message") {
      // Find recipients (all participants except sender)
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", record.conversation_id)
        .neq("user_id", record.sender_id);

      const { data: sender } = await supabase
        .from("profiles")
        .select("name, username")
        .eq("id", record.sender_id)
        .maybeSingle();

      const senderName = sender?.name || (sender?.username ? `@${sender.username}` : "Someone");
      const preview =
        record.message_type && record.message_type !== "text"
          ? `Sent ${record.message_type}`
          : (record.content || "New message").slice(0, 140);

      const payload = {
        title: senderName,
        body: preview,
        tag: `msg-${record.conversation_id}`,
        url: `/chat/${record.conversation_id}`,
      };

      let total = 0;
      for (const p of parts || []) {
        const r = await sendToUser(p.user_id, payload);
        total += r.sent;
      }
      return new Response(JSON.stringify({ ok: true, sent: total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "call") {
      const { data: caller } = await supabase
        .from("profiles")
        .select("name, username")
        .eq("id", record.caller_id)
        .maybeSingle();
      const callerName = caller?.name || (caller?.username ? `@${caller.username}` : "Someone");
      const payload = {
        title: record.call_type === "video" ? "Incoming video call" : "Incoming voice call",
        body: `${callerName} is calling you`,
        tag: `call-${record.id}`,
        url: `/call/${record.id}?role=callee`,
        requireInteraction: true,
        vibrate: [400, 200, 400, 200, 400],
      };
      const r = await sendToUser(record.callee_id, payload);
      return new Response(JSON.stringify({ ok: true, sent: r.sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-push] fatal", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

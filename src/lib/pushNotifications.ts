import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BLmVyqlcaRaSat1t_unuE-Yt87-LfiYwYrRuu_IJ-xQ3WvoJh3It1Pklr6MKNi4XeQge3h9R9TyegnWyIlmk0VA";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isPreviewOrIframe(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

function uint8ArrayToUrlBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function isCurrentVapidSubscription(sub: PushSubscription): Promise<boolean> {
  const appServerKey = sub.options.applicationServerKey;
  if (!appServerKey) return false;

  const keyBytes = new Uint8Array(appServerKey);
  return uint8ArrayToUrlBase64(keyBytes) === VAPID_PUBLIC_KEY;
}

async function hasStoredSubscription(endpoint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error) {
    console.error("[push] check stored sub failed", error);
    return false;
  }

  return Boolean(data?.id);
}

async function persistSubscription(sub: PushSubscription): Promise<{ ok: boolean; reason?: string }> {
  const json: any = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no-user" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] save sub failed", error);
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

async function clearSubscription(sub: PushSubscription | null | undefined): Promise<void> {
  if (!sub) return;

  try {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  } catch (error) {
    console.error("[push] delete sub failed", error);
  }

  try {
    await sub.unsubscribe();
  } catch (error) {
    console.error("[push] unsubscribe failed", error);
  }
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (isPreviewOrIframe()) {
    // Don't register in editor preview iframe - won't work and pollutes cache
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error("[push] SW register failed", e);
    return null;
  }
}

export async function getPushEnabled(): Promise<boolean> {
  if (!(await isPushSupported()) || isPreviewOrIframe()) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;

  const isValid = await isCurrentVapidSubscription(sub);
  if (!isValid) return false;

  return hasStoredSubscription(sub.endpoint);
}

export async function syncPushSubscription(): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isPushSupported())) return { ok: false, reason: "unsupported" };
  if (isPreviewOrIframe()) return { ok: false, reason: "preview" };
  if (Notification.permission !== "granted") return { ok: false, reason: "denied" };

  return subscribeToPush({ skipPermissionPrompt: true });
}

export async function subscribeToPush(options?: { forceRefresh?: boolean; skipPermissionPrompt?: boolean }): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isPushSupported())) return { ok: false, reason: "unsupported" };
  if (isPreviewOrIframe()) return { ok: false, reason: "preview" };

  const permission = options?.skipPermissionPrompt && Notification.permission !== "granted"
    ? Notification.permission
    : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw-failed" };

  let sub = await reg.pushManager.getSubscription();
  const staleSubscription = sub ? !(await isCurrentVapidSubscription(sub)) : false;

  if (sub && (options?.forceRefresh || staleSubscription)) {
    await clearSubscription(sub);
    sub = null;
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  return persistSubscription(sub);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await clearSubscription(sub);
}

export async function getPushStatus(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (!(await isPushSupported())) return "unsupported";
  return Notification.permission;
}

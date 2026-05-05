import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { registerServiceWorker, subscribeToPush, getPushStatus, getPushEnabled } from "@/lib/pushNotifications";

// Mounts once. If the user has already granted notification permission,
// silently re-subscribes so push works after reloads / new devices.
export default function PushBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    (async () => {
      await registerServiceWorker();
      const status = await getPushStatus();
      if (status === "granted") {
        const enabled = await getPushEnabled();
        if (!enabled) {
          await subscribeToPush({ forceRefresh: true, skipPermissionPrompt: true });
        }
      }
    })();
  }, [user]);

  return null;
}

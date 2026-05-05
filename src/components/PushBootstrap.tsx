import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ensurePushReady } from "@/lib/pushNotifications";

// Mounts once. If the user has already granted notification permission,
// silently re-subscribes so push works after reloads / new devices.
export default function PushBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    (async () => {
      await ensurePushReady();
    })();
  }, [user]);

  return null;
}

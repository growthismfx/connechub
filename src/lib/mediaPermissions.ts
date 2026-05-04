export type MediaPermissionState = "unknown" | "checking" | "granted" | "denied" | "prompt" | "unsupported";

export async function queryMediaPermission(needVideo: boolean): Promise<MediaPermissionState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return "unsupported";
  if (!("permissions" in navigator)) return "unknown";
  try {
    const mic = await (navigator.permissions as any).query({ name: "microphone" as PermissionName });
    let cam: PermissionStatus | null = null;
    if (needVideo) {
      try {
        cam = await (navigator.permissions as any).query({ name: "camera" as PermissionName });
      } catch {
        cam = null;
      }
    }
    const states = [mic.state, cam?.state].filter(Boolean) as PermissionState[];
    if (states.includes("denied")) return "denied";
    if (states.every((s) => s === "granted")) return "granted";
    return "prompt";
  } catch {
    return "unknown";
  }
}

export async function requestMediaStream(needVideo: boolean): Promise<{ stream: MediaStream | null; state: MediaPermissionState; error?: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, state: "unsupported", error: "Your browser doesn't support audio/video calls." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: needVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
    });
    return { stream, state: "granted" };
  } catch (err: any) {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { stream: null, state: "denied", error: "Microphone/Camera permission was blocked." };
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return { stream: null, state: "denied", error: "No microphone or camera was found on this device." };
    }
    if (name === "NotReadableError") {
      return { stream: null, state: "denied", error: "Microphone or camera is already in use by another app." };
    }
    return { stream: null, state: "denied", error: err?.message || "Could not access microphone/camera." };
  }
}

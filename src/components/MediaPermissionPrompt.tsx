import { Mic, Video, ShieldAlert, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  needVideo: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onCancel: () => void;
};

export default function MediaPermissionPrompt({ needVideo, errorMessage, onRetry, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur p-4">
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-2xl">
        <div className="flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-4" style={{ background: "var(--gradient-card)" }}>
          <ShieldAlert className="w-6 h-6 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-center">Permission needed</h2>
        <p className="text-sm text-muted-foreground text-center mt-2">
          {errorMessage || `To start this call we need access to your ${needVideo ? "camera and microphone" : "microphone"}.`}
        </p>

        <div className="mt-5 space-y-2 text-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2">
            <Mic className="w-4 h-4" /> Microphone
          </div>
          {needVideo && (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2">
              <Video className="w-4 h-4" /> Camera
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          If your browser already blocked access, tap the lock icon in the address bar and re-enable
          {needVideo ? " camera and microphone" : " microphone"}, then try again.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="ghost" className="rounded-full" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button className="rounded-full text-foreground border-0" style={{ background: "var(--gradient-cta)" }} onClick={onRetry}>
            <RefreshCcw className="w-4 h-4 mr-2" /> Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

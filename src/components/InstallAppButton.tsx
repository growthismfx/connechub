import { useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { toast } from "sonner";

export default function InstallAppButton() {
  const { canInstall, installed, isIos, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (installed) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="w-4 h-4" /> App installed
      </div>
    );
  }

  const onClick = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast.success("Installing app…");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button onClick={onClick} className="rounded-full" style={{ background: "var(--gradient-cta)" }}>
        <Download className="w-4 h-4 mr-2" />
        Install app
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ConnectHub to your home screen</DialogTitle>
            <DialogDescription>
              Install ConnectHub like a real app — it opens full-screen and stays on your home screen.
            </DialogDescription>
          </DialogHeader>
          {isIos ? (
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
              <li>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button at the bottom of Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
          ) : (
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
              <li>Open your browser menu (⋮ on Android Chrome).</li>
              <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              <li>Confirm to add ConnectHub to your device.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

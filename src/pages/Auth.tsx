import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const signIn = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Sign-in failed");
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-[var(--shadow-bubble)]" style={{ background: "var(--gradient-cta)" }}>
        <MessageCircle className="w-12 h-12 text-foreground" />
      </div>
      <h1 className="text-4xl font-bold mb-3">Clubhouse</h1>
      <p className="text-muted-foreground mb-12 max-w-xs">Connect, chat, and meet — all in one warm, friendly space.</p>
      <Button onClick={signIn} className="w-full max-w-xs h-14 rounded-full text-base font-semibold text-foreground border-0 shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
        Continue with Google
      </Button>
    </div>
  );
}

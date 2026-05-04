import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "signin";
  const isSignup = mode === "signup";

  const go = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Sign-in failed");
  };

  return (
    <div className="min-h-screen flex flex-col px-8 pt-12 pb-10">
      <button onClick={() => nav("/")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center mb-8">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-[var(--shadow-bubble)]" style={{ background: "var(--gradient-cta)" }}>
          <MessageCircle className="w-10 h-10 text-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="text-muted-foreground mb-12 max-w-xs">
          {isSignup ? "Join Clubhouse and start connecting." : "Sign in to continue your chats."}
        </p>

        <Button
          onClick={go}
          className="w-full max-w-xs h-14 rounded-full text-foreground border-0 shadow-[var(--shadow-pill)] font-semibold gap-3"
          style={{ background: "var(--gradient-cta)" }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </Button>

        <button
          onClick={() => nav(isSignup ? "/auth?mode=signin" : "/auth?mode=signup")}
          className="mt-6 text-sm text-muted-foreground"
        >
          {isSignup ? "Already have an account? " : "New here? "}
          <span className="font-semibold text-foreground underline">{isSignup ? "Sign in" : "Sign up"}</span>
        </button>
      </div>
    </div>
  );
}

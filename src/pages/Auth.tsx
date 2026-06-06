import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable/index";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "signin";
  const isSignup = mode === "signup";
  const [showPwd, setShowPwd] = useState(false);

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Sign-in failed");
  };

  const emailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("Use Google to continue — email/password coming soon");
  };

  return (
    <div className="min-h-screen flex flex-col px-7 pt-12 pb-10 bg-background">
      <button
        onClick={() => nav("/")}
        className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center mb-6 shadow-[var(--shadow-pill)]"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <h1 className="text-3xl font-bold mb-1">
        {isSignup ? "Create your account " : "Welcome back "}
        <span>{isSignup ? "✨" : "👋"}</span>
      </h1>
      <p className="text-muted-foreground mb-8">{isSignup ? "Let's get you all set up" : "Sign in to continue"}</p>

      <form onSubmit={emailSubmit} className="space-y-5">
        {isSignup && (
          <div>
            <label className="text-sm font-medium block mb-2">Full name</label>
            <Input placeholder="Enter your name" className="h-12 rounded-2xl border-border bg-white" />
          </div>
        )}
        <div>
          <label className="text-sm font-medium block mb-2">Email or phone</label>
          <Input placeholder="Enter email or phone" className="h-12 rounded-2xl border-border bg-white" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Password</label>
            {!isSignup && (
              <button type="button" className="text-sm font-medium" style={{ color: "hsl(var(--primary))" }}>
                Forgot?
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              placeholder={isSignup ? "Create a password" : "Enter your password"}
              className="h-12 rounded-2xl border-border bg-white pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-13 mt-2 h-13 rounded-full text-primary-foreground border-0 shadow-[var(--shadow-pill)] font-semibold"
          style={{ background: "var(--gradient-cta)", height: "52px" }}
        >
          {isSignup ? "Create Account" : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={google}
          className="w-14 h-14 rounded-full bg-white border border-border shadow-[var(--shadow-pill)] flex items-center justify-center"
          aria-label="Continue with Google"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        </button>
        <button
          onClick={() => toast.info("Apple sign-in coming soon")}
          className="w-14 h-14 rounded-full bg-white border border-border shadow-[var(--shadow-pill)] flex items-center justify-center"
          aria-label="Continue with Apple"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
        </button>
      </div>

      <p className="text-sm text-muted-foreground text-center mt-8">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <button
          onClick={() => nav(isSignup ? "/auth?mode=signin" : "/auth?mode=signup")}
          className="font-semibold"
          style={{ color: "hsl(var(--primary))" }}
        >
          {isSignup ? "Sign in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}

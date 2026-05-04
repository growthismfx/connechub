import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function GetStarted() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col px-8 pt-20 pb-10">
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="relative mb-10">
          <div className="absolute inset-0 blur-3xl opacity-60" style={{ background: "var(--gradient-cta)" }} />
          <div className="relative w-32 h-32 rounded-[2rem] flex items-center justify-center shadow-[var(--shadow-bubble)]" style={{ background: "var(--gradient-cta)" }}>
            <MessageCircle className="w-16 h-16 text-foreground" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-5xl font-bold mb-4 tracking-tight">Clubhouse</h1>
        <p className="text-muted-foreground text-lg max-w-xs mb-12 leading-relaxed">
          Private, real-time messaging with the people who matter.
        </p>

        <div className="space-y-3 w-full max-w-xs mb-10">
          {[
            { i: Shield, t: "End-to-end privacy" },
            { i: Zap, t: "Instant delivery" },
            { i: Sparkles, t: "Voice, video & status" },
          ].map(({ i: Icon, t }) => (
            <div key={t} className="flex items-center gap-3 bg-white/70 backdrop-blur rounded-2xl px-4 py-3 shadow-[var(--shadow-soft)]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={() => nav("/auth")}
        className="h-14 rounded-full text-foreground border-0 shadow-[var(--shadow-pill)] font-semibold text-base"
        style={{ background: "var(--gradient-cta)" }}
      >
        Get Started
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-4">By continuing, you agree to our Terms & Privacy.</p>
    </div>
  );
}

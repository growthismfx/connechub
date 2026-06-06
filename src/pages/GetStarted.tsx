import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import hellowIcon from "@/assets/hellow-icon.png.asset.json";

export default function GetStarted() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col px-8 pt-20 pb-10 bg-background relative overflow-hidden">
      {/* soft blobs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-60 blur-3xl" style={{ background: "hsl(258 100% 92%)" }} />
      <div className="absolute -bottom-32 -right-20 w-80 h-80 rounded-full opacity-50 blur-3xl" style={{ background: "hsl(280 100% 92%)" }} />

      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 animate-fade-in">
        <img
          src={hellowIcon.url}
          alt="hellow"
          width={112}
          height={112}
          className="w-28 h-28 rounded-[28px] shadow-[var(--shadow-bubble)] mb-8"
        />
        <h1 className="text-4xl font-bold mb-3 tracking-tight" style={{ color: "hsl(var(--foreground))" }}>hellow</h1>
        <p className="text-muted-foreground max-w-xs leading-relaxed">A new way to connect.</p>
        <p className="text-muted-foreground max-w-xs leading-relaxed">Fast. Secure. Beautiful.</p>
      </div>

      <div className="relative z-10">
        <Button
          onClick={() => nav("/auth?mode=signup")}
          className="w-full h-14 rounded-full text-primary-foreground border-0 shadow-[var(--shadow-pill)] font-semibold text-base"
          style={{ background: "var(--gradient-cta)" }}
        >
          Get Started
        </Button>
        <p className="text-sm text-muted-foreground text-center mt-5">
          Already have an account?{" "}
          <button onClick={() => nav("/auth?mode=signin")} className="font-semibold" style={{ color: "hsl(var(--primary))" }}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

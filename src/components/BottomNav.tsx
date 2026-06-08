import { MessageCircle, Phone, Compass, User, MessageSquarePlus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutEffect, useRef, useState } from "react";

const items = [
  { icon: MessageCircle, path: "/chats", label: "Chats" },
  { icon: Phone, path: "/calls", label: "Calls" },
  { icon: null, path: "/__center", label: "" },
  { icon: Compass, path: "/discover", label: "Explore" },
  { icon: User, path: "/settings", label: "Profile" },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [blob, setBlob] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const isActive = (p: string) =>
    loc.pathname === p ||
    (p === "/chats" && (loc.pathname === "/" || loc.pathname.startsWith("/chat")));

  const activeIdx = items.findIndex((i) => i.path !== "/__center" && isActive(i.path));

  useLayoutEffect(() => {
    const el = itemRefs.current[activeIdx];
    const wrap = containerRef.current;
    if (!el || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setBlob({ left: r.left - wrapRect.left, width: r.width });
  }, [activeIdx, loc.pathname]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-5 pb-4 pt-2 pointer-events-none">
      <div className="relative max-w-md mx-auto pointer-events-auto">
        {/* Center floating action */}
        <button
          onClick={() => nav("/chats")}
          className="absolute left-1/2 -translate-x-1/2 -top-7 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-[0_14px_30px_-8px_hsl(var(--primary)/0.65)] z-20 transition-transform active:scale-90 hover:scale-105 animate-scale-in"
          style={{ background: "var(--gradient-cta)", backgroundSize: "200% 200%", animation: "gradient-shift 6s ease infinite, scale-in 0.3s ease-out" }}
          aria-label="Chats"
        >
          <span className="absolute inset-0 rounded-full opacity-50 blur-xl" style={{ background: "var(--gradient-cta)" }} />
          <MessageSquarePlus className="w-7 h-7 relative" />
        </button>

        <div
          ref={containerRef}
          className="relative flex items-center bg-white/85 backdrop-blur-2xl border border-white/40 rounded-[32px] shadow-[var(--shadow-pill)] px-2 py-2 overflow-hidden"
        >
          {/* Water-drop blob indicator */}
          <span
            className="nav-waterdrop"
            style={{
              left: blob.left,
              width: blob.width,
            }}
          />
          {items.map((i, idx) => {
            if (i.path === "/__center") return <div key={idx} className="w-16 shrink-0" />;
            const Icon = i.icon!;
            const a = isActive(i.path);
            return (
              <button
                key={i.path}
                ref={(el) => (itemRefs.current[idx] = el)}
                onClick={() => nav(i.path)}
                className="relative flex flex-col items-center gap-0.5 flex-1 py-2 transition-transform active:scale-95"
              >
                <Icon
                  className="w-[22px] h-[22px] transition-all duration-300"
                  style={{
                    color: a ? "white" : "hsl(var(--muted-foreground))",
                    transform: a ? "translateY(-2px) scale(1.08)" : "none",
                    filter: a ? "drop-shadow(0 4px 8px hsl(var(--primary) / 0.5))" : "none",
                  }}
                />
                <span
                  className="text-[10px] font-semibold transition-all duration-300"
                  style={{
                    color: a ? "white" : "hsl(var(--muted-foreground))",
                    opacity: a ? 1 : 0.85,
                  }}
                >
                  {i.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

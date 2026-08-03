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
    <div className="fixed bottom-0 left-0 right-0 z-30 px-5 pb-5 pt-2 pointer-events-none">
      <div className="relative w-fit max-w-full mx-auto pointer-events-auto">
        <div
          ref={containerRef}
          className="relative flex items-center gap-1 bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_16px_38px_-16px_rgba(30,60,120,0.75)] px-2.5 py-2"
        >
          {items.map((i, idx) => {
            if (i.path === "/__center") {
              return (
                <button
                  key={idx}
                  onClick={() => nav("/chats")}
                  className="mx-1 flex items-center gap-2 rounded-full px-4 h-11 text-white font-semibold text-[13px] shadow-[0_10px_22px_-10px_hsl(var(--primary)/0.8)] active:scale-95 transition-transform"
                  style={{ background: "var(--gradient-cta)" }}
                >
                  <MessageSquarePlus className="w-[18px] h-[18px]" />
                  Message
                </button>
              );
            }
            const Icon = i.icon!;
            const a = isActive(i.path);
            return (
              <button
                key={i.path}
                ref={(el) => (itemRefs.current[idx] = el)}
                onClick={() => nav(i.path)}
                aria-label={i.label}
                className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: a ? "hsl(var(--muted))" : "transparent" }}
              >
                <Icon
                  className="w-[20px] h-[20px] transition-colors duration-300"
                  style={{ color: a ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

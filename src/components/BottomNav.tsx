import { MessageCircle, Circle, Phone, Settings as Cog } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const items = [
  { icon: MessageCircle, path: "/chats", label: "Chats" },
  { icon: Circle, path: "/status", label: "Status" },
  { icon: Phone, path: "/calls", label: "Calls" },
  { icon: Cog, path: "/settings", label: "Settings" },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const activeIndex = items.findIndex(({ path }) =>
    loc.pathname === path || (path === "/chats" && (loc.pathname === "/" || loc.pathname.startsWith("/chat")))
  );

  useEffect(() => {
    const el = btnRefs.current[activeIndex];
    const wrap = containerRef.current;
    if (!el || !wrap) return;
    const w = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setIndicator({ left: r.left - w.left, width: r.width, ready: true });
  }, [activeIndex, loc.pathname]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
      <div ref={containerRef} className="relative flex items-center gap-1 bg-white/90 backdrop-blur p-2 shadow-[var(--shadow-pill)] themed-nav">
        {indicator.ready && activeIndex >= 0 && (
          <span className="nav-liquid" style={{ left: indicator.left, width: indicator.width }} />
        )}
        {items.map(({ icon: Icon, path, label }, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={path}
              ref={(el) => (btnRefs.current[i] = el)}
              onClick={() => nav(path)}
              className="relative z-10 flex items-center gap-2 themed-nav px-4 py-3 transition-colors"
            >
              <Icon className="w-5 h-5 text-foreground" />
              {active && <span className="text-sm font-semibold text-foreground animate-fade-in">{label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

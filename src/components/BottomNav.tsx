import { MessageCircle, Phone, Compass, User, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const items = [
  { icon: MessageCircle, path: "/chats", label: "Chats" },
  { icon: Phone, path: "/calls", label: "Calls" },
  { icon: Compass, path: "/discover", label: "Explore" },
  { icon: User, path: "/settings", label: "Profile" },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();

  const isActive = (path: string) =>
    loc.pathname === path || (path === "/chats" && (loc.pathname === "/" || loc.pathname.startsWith("/chat")));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pb-3 pt-2 px-4 pointer-events-none">
      <div className="relative max-w-md mx-auto pointer-events-auto">
        {/* floating center action */}
        <button
          onClick={() => nav("/status")}
          className="absolute left-1/2 -translate-x-1/2 -top-7 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[var(--shadow-bubble)] z-10"
          style={{ background: "var(--gradient-cta)" }}
          aria-label="New"
        >
          <Plus className="w-6 h-6" />
        </button>

        <div className="flex items-center justify-around bg-white border border-border rounded-[28px] shadow-[var(--shadow-pill)] px-3 py-2.5">
          {items.slice(0, 2).map(({ icon: Icon, path, label }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => nav(path)}
                className="flex flex-col items-center gap-0.5 px-4 py-1 transition-colors"
              >
                <Icon className="w-5 h-5" style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
                <span className="text-[10px] font-medium" style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* spacer for center button */}
          <div className="w-14 shrink-0" />

          {items.slice(2).map(({ icon: Icon, path, label }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => nav(path)}
                className="flex flex-col items-center gap-0.5 px-4 py-1 transition-colors"
              >
                <Icon className="w-5 h-5" style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
                <span className="text-[10px] font-medium" style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { Home, Compass, MessageCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const items = [
  { icon: Home, path: "/", label: "Home" },
  { icon: Compass, path: "/discover", label: "Discover" },
  { icon: MessageCircle, path: "/chats", label: "Chat" },
  { icon: User, path: "/profile", label: "Profile" },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur rounded-full p-2 shadow-[var(--shadow-pill)]">
        {items.map(({ icon: Icon, path, label }) => {
          const active = loc.pathname === path || (path === "/chats" && loc.pathname.startsWith("/chat"));
          return (
            <button
              key={path}
              onClick={() => nav(path)}
              className="flex items-center gap-2 rounded-full px-4 py-3 transition-all"
              style={active ? { background: "var(--gradient-cta)" } : {}}
            >
              <Icon className="w-5 h-5 text-foreground" />
              {active && <span className="text-sm font-semibold text-foreground">{label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

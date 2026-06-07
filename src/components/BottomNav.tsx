import { MessageCircle, Phone, Compass, User, MessageSquarePlus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const left = [
  { icon: MessageCircle, path: "/chats", label: "Chats" },
  { icon: Phone, path: "/calls", label: "Calls" },
];
const right = [
  { icon: Compass, path: "/discover", label: "Explore" },
  { icon: User, path: "/settings", label: "Profile" },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  const isActive = (p: string) =>
    loc.pathname === p || (p === "/chats" && (loc.pathname === "/" || loc.pathname.startsWith("/chat")));

  const Item = ({ icon: Icon, path, label }: any) => {
    const a = isActive(path);
    return (
      <button
        onClick={() => nav(path)}
        className="flex flex-col items-center gap-1 flex-1 py-1 transition-transform active:scale-95"
      >
        <Icon
          className="w-[22px] h-[22px] transition-colors"
          style={{ color: a ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
        />
        <span
          className="text-[10px] font-medium transition-colors"
          style={{ color: a ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-5 pb-4 pt-2 pointer-events-none">
      <div className="relative max-w-md mx-auto pointer-events-auto">
        <button
          onClick={() => nav("/chats")}
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.6)] z-10 transition-transform active:scale-95 animate-scale-in"
          style={{ background: "var(--gradient-cta)" }}
          aria-label="Chats"
        >
          <MessageSquarePlus className="w-6 h-6" />
        </button>
        <div className="flex items-center bg-white/95 backdrop-blur-xl border border-border/60 rounded-[28px] shadow-[var(--shadow-pill)] px-3 py-2.5">
          {left.map((i) => <Item key={i.path} {...i} />)}
          <div className="w-14 shrink-0" />
          {right.map((i) => <Item key={i.path} {...i} />)}
        </div>
      </div>
    </div>
  );
}

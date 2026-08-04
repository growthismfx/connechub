import { MessageCircle, Phone, Compass, User, MessageSquarePlus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const items = [
  { icon: MessageCircle, path: "/chats", label: "Chats" },
  { icon: Phone, path: "/calls", label: "Calls" },
  { icon: null, path: "/__center", label: "" },
  { icon: Compass, path: "/discover", label: "Explore" },
  { icon: User, path: "/settings", label: "Profile" },
];

const spring = { type: "spring" as const, stiffness: 480, damping: 34, mass: 0.7 };

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();

  const isActive = (p: string) =>
    loc.pathname === p ||
    (p === "/chats" && (loc.pathname === "/" || loc.pathname.startsWith("/chat")));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-5 pb-5 pt-2 pointer-events-none">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.05 }}
        className="relative w-fit max-w-full mx-auto pointer-events-auto"
        style={{ willChange: "transform" }}
      >
        <div className="relative flex items-center gap-1 bg-white/85 backdrop-blur-2xl rounded-full shadow-[0_16px_38px_-16px_rgba(30,60,120,0.75)] px-2.5 py-2 border border-white/70">
          {items.map((i, idx) => {
            if (i.path === "/__center") {
              return (
                <motion.button
                  key={idx}
                  onClick={() => nav("/chats")}
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ y: -1 }}
                  transition={spring}
                  className="mx-1 flex items-center gap-2 rounded-full px-4 h-11 text-white font-semibold text-[13px] shadow-[0_10px_22px_-10px_hsl(var(--primary)/0.85)]"
                  style={{ background: "var(--gradient-cta)", willChange: "transform" }}
                >
                  <MessageSquarePlus className="w-[18px] h-[18px]" />
                  Message
                </motion.button>
              );
            }
            const Icon = i.icon!;
            const a = isActive(i.path);
            return (
              <motion.button
                key={i.path}
                onClick={() => nav(i.path)}
                aria-label={i.label}
                whileTap={{ scale: 0.9 }}
                transition={spring}
                className="relative w-11 h-11 rounded-full flex items-center justify-center"
                style={{ willChange: "transform" }}
              >
                {a && (
                  <motion.span
                    layoutId="nav-blob"
                    transition={spring}
                    className="absolute inset-0 rounded-full"
                    style={{ background: "hsl(var(--muted))" }}
                  />
                )}
                <motion.span
                  animate={{ scale: a ? 1.08 : 1 }}
                  transition={spring}
                  className="relative"
                >
                  <Icon
                    className="w-[20px] h-[20px] transition-colors duration-300"
                    style={{ color: a ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                  />
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

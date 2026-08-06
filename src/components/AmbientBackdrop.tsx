import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Soft ambient gradient backdrop with slowly drifting warm/cool orbs.
 * GPU-only transforms so it never causes layout work.
 */
export default function AmbientBackdrop({ variant = "chat" }: { variant?: "chat" | "explore" }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const orbs = Array.from(el.querySelectorAll<HTMLElement>("[data-orb]"));
    const ctx = gsap.context(() => {
      orbs.forEach((o, i) => {
        gsap.to(o, {
          xPercent: i % 2 === 0 ? 12 : -14,
          yPercent: i % 2 === 0 ? -10 : 14,
          scale: 1.12,
          duration: 14 + i * 3,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          force3D: true,
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const base =
    variant === "explore"
      ? "linear-gradient(180deg, hsl(18 60% 12%) 0%, hsl(20 20% 8%) 45%, hsl(20 10% 6%) 100%)"
      : "linear-gradient(175deg, hsl(18 55% 12%) 0%, hsl(20 20% 8%) 40%, hsl(20 10% 6%) 100%)";

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: base }} />
      <div
        data-orb
        className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full blur-[90px] opacity-70"
        style={{ background: "radial-gradient(circle, hsl(24 96% 55% / 0.55), transparent 70%)", willChange: "transform" }}
      />
      <div
        data-orb
        className="absolute top-1/3 -right-24 w-[380px] h-[380px] rounded-full blur-[100px] opacity-55"
        style={{ background: "radial-gradient(circle, hsl(12 92% 50% / 0.5), transparent 70%)", willChange: "transform" }}
      />
      <div
        data-orb
        className="absolute -bottom-32 left-1/4 w-[440px] h-[440px] rounded-full blur-[110px] opacity-45"
        style={{ background: "radial-gradient(circle, hsl(32 100% 58% / 0.35), transparent 70%)", willChange: "transform" }}
      />
    </div>
  );
}


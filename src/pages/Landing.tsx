import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MessageCircle, Phone, Users, Sparkles, ShieldCheck, Radio, ArrowRight, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import hellowIcon from "@/assets/hellow-icon.png.asset.json";
import glassArt from "@/assets/landing-glass.png";

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { value: "120k+", label: "Messages every day" },
  { value: "99.9%", label: "Delivery uptime" },
  { value: "40+", label: "Countries connected" },
];

const features = [
  { icon: MessageCircle, title: "Instant chats", text: "Realtime messaging with typing, delivery and read receipts." },
  { icon: Phone, title: "HD calls", text: "Crystal clear voice and video calls that survive app switching." },
  { icon: Users, title: "Groups & servers", text: "Communities, group chats and Discord-style servers in one app." },
  { icon: Radio, title: "Stories", text: "Photo, video and text stories with music, polls and view counts." },
  { icon: Sparkles, title: "Themes", text: "iOS, glass, Samsung, neon and more — customise everything." },
  { icon: ShieldCheck, title: "Private by design", text: "App lock, biometrics, blocking and granular privacy controls." },
];

export default function Landing() {
  const nav = useNavigate();
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".gs-hero > *", {
        y: 32, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.09,
      });
      gsap.to(".gs-float", {
        y: -18, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1,
      });
      gsap.utils.toArray<HTMLElement>(".gs-reveal").forEach((el) => {
        gsap.from(el, {
          y: 40, opacity: 0, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ambient blobs */}
      <div aria-hidden className="pointer-events-none fixed -top-40 -left-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-60" style={{ background: "hsl(258 100% 92%)" }} />
      <div aria-hidden className="pointer-events-none fixed top-1/3 -right-32 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-50" style={{ background: "hsl(280 100% 92%)" }} />

      {/* Nav */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="mx-auto max-w-5xl flex items-center gap-3 rounded-full border border-border/60 bg-background/70 backdrop-blur-xl px-4 py-2.5 shadow-[var(--shadow-pill)]">
          <img src={hellowIcon.url} alt="hellow logo" width={32} height={32} className="w-8 h-8 rounded-xl" />
          <span className="font-bold tracking-tight">hellow</span>
          <div className="hidden md:flex items-center gap-6 ml-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#start" className="hover:text-foreground transition-colors">Get started</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => nav("/auth?mode=signin")} className="text-sm font-medium px-3 py-1.5 rounded-full hover:bg-muted transition-colors">
              Sign in
            </button>
            <Button onClick={() => nav("/auth?mode=signup")} className="rounded-full h-9 px-5 text-primary-foreground border-0" style={{ background: "var(--gradient-cta)" }}>
              Join free
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main>
        <section className="relative px-6 pt-14 pb-8 md:pt-24">
          <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-10 items-center">
            <div className="gs-hero">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <Sparkles className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> A new way to connect
              </span>
              <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                Chat, call and share with <span style={{ background: "var(--gradient-cta)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>hellow</span>
              </h1>
              <p className="mt-5 text-muted-foreground text-base md:text-lg max-w-md leading-relaxed">
                Messaging, HD calls, stories, groups and servers — one beautifully fast app built for people who care how things feel.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button onClick={() => nav("/auth?mode=signup")} className="rounded-full h-12 px-7 text-primary-foreground border-0 font-semibold shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
                  Get started free <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <button onClick={() => nav("/auth?mode=signin")} className="rounded-full h-12 px-6 border border-border/70 bg-background/70 backdrop-blur font-medium hover:bg-muted transition-colors">
                  I already have an account
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["Free forever", "No ads", "Private by default"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} /> {t}
                  </span>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <img
                src={glassArt}
                alt="Translucent 3D glass shapes representing the hellow experience"
                width={1024}
                height={1024}
                className="gs-float w-full max-w-md mx-auto drop-shadow-2xl select-none"
              />
              <div className="absolute -bottom-4 left-0 right-0 mx-auto w-fit rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl px-5 py-3 shadow-[var(--shadow-bubble)]">
                <p className="text-xs text-muted-foreground">Active conversations</p>
                <p className="text-xl font-bold">2.4M+</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-6 py-10">
          <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="gs-reveal rounded-3xl border border-border/60 bg-background/70 backdrop-blur-xl p-6 shadow-[var(--shadow-bubble)]">
                <p className="text-3xl font-bold tracking-tight">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="gs-reveal text-3xl md:text-4xl font-bold tracking-tight max-w-lg">
              Everything you need to stay close
            </h2>
            <p className="gs-reveal mt-3 text-muted-foreground max-w-md">
              Built mobile-first, tuned for speed, and designed so every interaction feels effortless.
            </p>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <motion.article
                  key={f.title}
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="gs-reveal rounded-3xl border border-border/60 bg-background/70 backdrop-blur-xl p-6 shadow-[var(--shadow-bubble)]"
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "hsl(var(--primary) / 0.12)" }}>
                    <f.icon className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
                  </div>
                  <h3 className="font-semibold text-[15px]">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Platform band */}
        <section id="platform" className="px-6 py-14">
          <div className="gs-reveal mx-auto max-w-5xl rounded-[2rem] p-8 md:p-12 text-primary-foreground relative overflow-hidden shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
            <div className="relative z-10 max-w-xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">One app. Every conversation.</h2>
              <p className="mt-4 opacity-90 leading-relaxed">
                Move from a quick message to a video call, drop a story, or spin up a whole community server — without ever leaving hellow.
              </p>
              <Button onClick={() => nav("/auth?mode=signup")} className="mt-8 rounded-full h-12 px-7 bg-background text-foreground hover:bg-background/90 font-semibold border-0">
                Create your account
              </Button>
            </div>
            <div aria-hidden className="absolute -right-16 -bottom-24 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
          </div>
        </section>

        {/* CTA */}
        <section id="start" className="px-6 pb-20 pt-6">
          <div className="gs-reveal mx-auto max-w-2xl text-center">
            <img src={hellowIcon.url} alt="hellow app icon" width={64} height={64} loading="lazy" className="w-16 h-16 rounded-3xl mx-auto shadow-[var(--shadow-bubble)]" />
            <h2 className="mt-6 text-2xl md:text-3xl font-bold tracking-tight">Say hellow today</h2>
            <p className="mt-3 text-muted-foreground">Free to join. Takes less than a minute.</p>
            <Button onClick={() => nav("/auth?mode=signup")} className="mt-7 rounded-full h-13 px-8 py-3 text-primary-foreground border-0 font-semibold shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
              Get started free
            </Button>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 border-t border-border/50">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} hellow</p>
          <p>Made for people who love good conversations.</p>
        </div>
      </footer>
    </div>
  );
}

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
import person from "@/assets/landing-person.jpg";

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

        {/* Dark analytics band */}
        <section className="px-6">
          <div className="gs-reveal mx-auto max-w-5xl rounded-[2rem] overflow-hidden p-7 md:p-9 relative text-primary-foreground shadow-[var(--shadow-pill)]" style={{ background: "linear-gradient(120deg, hsl(240 30% 8%), hsl(258 45% 16%))" }}>
            <div aria-hidden className="absolute -right-24 -top-24 w-72 h-72 rounded-full blur-3xl" style={{ background: "hsl(258 100% 70% / 0.35)" }} />
            <div className="relative z-10 flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "hsl(0 0% 100% / 0.1)" }}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs opacity-70">Live now</p>
                  <p className="text-2xl font-bold tracking-tight">38,502</p>
                </div>
              </div>
              <div className="h-10 w-px bg-white/15 hidden md:block" />
              {[
                { k: "Messages / min", v: "12,940" },
                { k: "Calls in progress", v: "1,204" },
                { k: "Active servers", v: "3,118" },
              ].map((m) => (
                <div key={m.k}>
                  <p className="text-xs opacity-70">{m.k}</p>
                  <p className="text-2xl font-bold tracking-tight">{m.v}</p>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs backdrop-blur">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> All systems operational
              </div>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <section className="px-6 py-8">
          <div className="mx-auto max-w-5xl grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Daily messages", value: "223,978", pill: "+18%" },
              { label: "Voice minutes", value: "202,833", pill: "+9%" },
              { label: "Stories posted", value: "10,930", pill: "+24%" },
              { label: "Communities", value: "38,794", pill: "+12%" },
            ].map((s) => (
              <div key={s.label} className="gs-reveal rounded-3xl border border-border/60 bg-background/70 backdrop-blur-xl p-5 shadow-[var(--shadow-bubble)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-primary-foreground" style={{ background: "var(--gradient-cta)" }}>{s.pill}</span>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bento grid */}
        <section id="features" className="px-6 py-8">
          <div className="mx-auto max-w-5xl grid md:grid-cols-3 gap-4">
            <div className="gs-reveal rounded-[2rem] p-7 text-primary-foreground flex flex-col shadow-[var(--shadow-pill)]" style={{ background: "linear-gradient(160deg, hsl(240 30% 9%), hsl(262 40% 18%))" }}>
              <ShieldCheck className="w-6 h-6" />
              <h3 className="mt-6 text-2xl font-bold tracking-tight leading-tight">Private by design</h3>
              <p className="mt-3 text-sm opacity-80 leading-relaxed">App lock, biometrics, blocking and granular privacy controls on every conversation.</p>
              <Button onClick={() => nav("/auth?mode=signup")} className="mt-auto self-start rounded-full h-10 px-5 bg-background text-foreground hover:bg-background/90 border-0 font-semibold">
                Try it free
              </Button>
            </div>

            <div className="gs-reveal rounded-[2rem] border border-border/60 bg-background/70 backdrop-blur-xl p-6 shadow-[var(--shadow-bubble)]">
              <img
                src={person}
                alt="hellow community member"
                width={800}
                height={1000}
                loading="lazy"
                className="w-full h-52 object-cover rounded-2xl"
              />
              <h3 className="mt-5 font-semibold text-lg tracking-tight">Made for real conversations</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Typing indicators, read receipts and presence that update the instant they happen.
              </p>
            </div>

            <div className="grid gap-4">
              {features.slice(0, 3).map((f) => (
                <motion.article
                  key={f.title}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="gs-reveal rounded-3xl border border-border/60 bg-background/70 backdrop-blur-xl p-5 shadow-[var(--shadow-bubble)] flex items-start gap-3"
                >
                  <div className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.12)" }}>
                    <f.icon className="w-4.5 h-4.5" style={{ color: "hsl(var(--primary))" }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[15px]">{f.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.text}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-5xl grid sm:grid-cols-3 gap-4 mt-4">
            {features.slice(3).map((f) => (
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
        </section>

        {/* Plans */}
        <section id="platform" className="px-6 py-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="gs-reveal text-3xl md:text-4xl font-bold tracking-tight max-w-lg">Simple plans, no surprises</h2>
            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                { name: "Free", price: "$0", perks: ["Unlimited chats", "HD calls", "Stories & notes"], highlight: false },
                { name: "Plus", price: "$3", perks: ["Everything in Free", "All premium themes", "Bigger uploads"], highlight: true },
                { name: "Teams", price: "$9", perks: ["Servers & channels", "Admin controls", "Priority support"], highlight: false },
              ].map((p) => (
                <div
                  key={p.name}
                  className="gs-reveal rounded-3xl p-6 border shadow-[var(--shadow-bubble)]"
                  style={
                    p.highlight
                      ? { background: "var(--gradient-cta)", borderColor: "transparent", color: "hsl(var(--primary-foreground))" }
                      : { background: "hsl(var(--background) / 0.7)", borderColor: "hsl(var(--border) / 0.6)" }
                  }
                >
                  <p className={`text-sm font-medium ${p.highlight ? "opacity-90" : "text-muted-foreground"}`}>{p.name}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">{p.price}<span className="text-sm font-medium opacity-70">/mo</span></p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {p.perks.map((k) => (
                      <li key={k} className="flex items-center gap-2">
                        <Check className="w-4 h-4" style={{ color: p.highlight ? "currentColor" : "hsl(var(--primary))" }} /> {k}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => nav("/auth?mode=signup")}
                    className={`mt-6 w-full rounded-full h-11 font-semibold border-0 ${p.highlight ? "bg-background text-foreground hover:bg-background/90" : ""}`}
                    style={p.highlight ? undefined : { background: "var(--gradient-cta)", color: "hsl(var(--primary-foreground))" }}
                  >
                    Choose {p.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section id="start" className="px-6 pb-20 pt-4">
          <div className="gs-reveal mx-auto max-w-5xl rounded-[2rem] p-8 md:p-12 text-primary-foreground relative overflow-hidden shadow-[var(--shadow-pill)]" style={{ background: "linear-gradient(120deg, hsl(240 30% 8%), hsl(258 55% 22%))" }}>
            <div aria-hidden className="absolute -right-16 -bottom-24 w-80 h-80 rounded-full blur-3xl" style={{ background: "hsl(258 100% 70% / 0.35)" }} />
            <div className="relative z-10 max-w-xl">
              <img src={hellowIcon.url} alt="hellow app icon" width={56} height={56} loading="lazy" className="w-14 h-14 rounded-2xl" />
              <h2 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">One app. Every conversation.</h2>
              <p className="mt-4 opacity-85 leading-relaxed">
                Move from a quick message to a video call, drop a story, or spin up a whole community server — without ever leaving hellow.
              </p>
              <Button onClick={() => nav("/auth?mode=signup")} className="mt-8 rounded-full h-12 px-7 bg-background text-foreground hover:bg-background/90 font-semibold border-0">
                Create your account <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
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

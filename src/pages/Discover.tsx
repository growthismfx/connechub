import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, AtSign, Phone, ChevronRight, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const COMMUNITIES = [
  { name: "Photography Club", members: "12.8K members", color: "from-amber-300 to-rose-300" },
  { name: "Travel Enthusiasts", members: "8.6K members", color: "from-sky-300 to-emerald-300" },
  { name: "Music Lovers", members: "15.2K members", color: "from-fuchsia-300 to-violet-400" },
  { name: "Study & Learn", members: "9.1K members", color: "from-indigo-300 to-blue-400" },
];

export default function Discover() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [matchType, setMatchType] = useState<"username" | "phone" | "name">("username");
  const nav = useNavigate();

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      const isDigits = /^[0-9+]+$/.test(term);
      const cleaned = term.replace(/\D/g, "");
      let query = supabase
        .from("profiles")
        .select("id, name, username, avatar_url, assigned_number, country_code, is_online")
        .neq("id", user?.id || "");
      if (isDigits) {
        if (cleaned.length < 10) { setResults([]); setMatchType("phone"); return; }
        query = query.eq("assigned_number", cleaned.slice(-10));
        setMatchType("phone");
      } else {
        query = query.or(`username.ilike.%${term}%,name.ilike.%${term}%`);
        setMatchType("username");
      }
      const { data } = await query.limit(20);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user]);

  return (
    <div className="min-h-screen pb-32">
      <div className="px-5 pt-12 pb-3 flex items-center justify-between animate-fade-in">
        <h1 className="text-[26px] font-bold tracking-tight">Explore</h1>
        <button onClick={() => setQ(" ")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Hero banner */}
      <div className="px-5 mb-6">
        <div
          className="relative rounded-3xl p-5 text-white overflow-hidden shadow-[var(--shadow-bubble)] animate-scale-in"
          style={{ background: "var(--gradient-cta)" }}
        >
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute right-10 top-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative">
            <h2 className="text-lg font-bold leading-tight max-w-[70%]">Discover communities<br/>and connect with people</h2>
            <button onClick={() => nav("/discover")} className="mt-4 px-5 h-9 rounded-full bg-white text-[13px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Search input */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-3 bg-white rounded-full px-5 h-12 shadow-[var(--shadow-pill)] border border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q.trim()}
            onChange={(e) => setQ(e.target.value)}
            placeholder="@username or phone number"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        {q.trim() && (
          <p className="text-[11px] text-muted-foreground mt-2 px-3 flex items-center gap-1.5">
            {matchType === "phone" ? <Phone className="w-3 h-3" /> : <AtSign className="w-3 h-3" />}
            Searching by {matchType === "phone" ? "phone" : "username"}
          </p>
        )}
      </div>

      {/* Search results */}
      {q.trim() && (
        <div className="px-5 mb-6 space-y-2">
          {results.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">No matches</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => nav(`/chat/new/${p.id}?via=${matchType === "phone" ? "phone" : "username"}`)}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] active:scale-[0.99] transition-transform animate-fade-in"
            >
              <Avatar className="w-11 h-11">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback>{p.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold truncate text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Communities */}
      {!q.trim() && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[15px]">Communities</h3>
            <button className="text-sm font-medium" style={{ color: "hsl(var(--primary))" }}>See all</button>
          </div>
          <div className="space-y-2">
            {COMMUNITIES.map((c, i) => (
              <button
                key={c.name}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] active:scale-[0.99] transition-transform animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.members}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

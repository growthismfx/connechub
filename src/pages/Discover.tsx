import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, ArrowLeft, AtSign, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";

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
      // Detect intent: digits = phone, else username/name
      const isDigits = /^[0-9+]+$/.test(term);
      const cleaned = term.replace(/\D/g, "");
      let query = supabase
        .from("profiles")
        .select("id, name, username, avatar_url, assigned_number, country_code, is_online, status")
        .neq("id", user?.id || "");
      if (isDigits) {
        query = query.ilike("assigned_number", `%${cleaned}%`);
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
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Find people</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="@username or phone number"
          className="h-14 rounded-full pl-14 bg-white border-0 shadow-[var(--shadow-pill)]"
        />
      </div>
      <p className="text-xs text-muted-foreground mb-6 px-2 flex items-center gap-1.5">
        {matchType === "phone" ? <Phone className="w-3 h-3" /> : <AtSign className="w-3 h-3" />}
        {matchType === "phone" ? "Searching by phone number" : "Searching by username or name"}
      </p>

      <div className="space-y-2">
        {q && results.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">No matches found</p>
        )}
        {results.map((p) => {
          const showPhone = matchType === "phone";
          return (
            <button
              key={p.id}
              onClick={() => nav(`/chat/new/${p.id}?via=${matchType === "phone" ? "phone" : "username"}`)}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)] hover:scale-[1.01] transition-transform"
            >
              <div className="relative">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback>{p.name?.[0]}</AvatarFallback>
                </Avatar>
                {p.is_online && <span className="absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white" style={{ background: "hsl(var(--online))" }} />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  {showPhone ? (
                    <><Phone className="w-3 h-3" />{p.country_code}{p.assigned_number}</>
                  ) : (
                    <><AtSign className="w-3 h-3" />{p.username}</>
                  )}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-full">
                via {matchType === "phone" ? "phone" : "username"}
              </span>
            </button>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}

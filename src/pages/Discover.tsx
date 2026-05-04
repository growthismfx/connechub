import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";

export default function Discover() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase.from("profiles").select("id, name, username, avatar_url, assigned_number, country_code, is_online").neq("id", user?.id || "");
      if (q.trim()) {
        query = query.or(`username.ilike.%${q}%,assigned_number.ilike.%${q}%,name.ilike.%${q}%`);
      }
      const { data } = await query.limit(30);
      setResults(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user]);

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Discover</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Username or number"
          className="h-14 rounded-full pl-14 bg-white border-0 shadow-[var(--shadow-pill)]"
        />
      </div>

      <div className="space-y-2">
        {results.map((p) => (
          <button key={p.id} onClick={() => nav(`/chat/new/${p.id}`)} className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
            <div className="relative">
              <Avatar className="w-12 h-12">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback>{p.name?.[0]}</AvatarFallback>
              </Avatar>
              {p.is_online && <span className="absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white" style={{ background: "hsl(var(--online))" }} />}
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">@{p.username || "—"} · {p.country_code}{p.assigned_number}</p>
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

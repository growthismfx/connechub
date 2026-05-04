import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Search, Calendar, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

export default function Home() {
  const { profile } = useAuth();
  const [people, setPeople] = useState<any[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    supabase.from("profiles").select("id, name, avatar_url, username").limit(10).then(({ data }) => setPeople(data || []));
  }, []);

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{profile?.name}</h1>
            <p className="text-sm text-muted-foreground">@{profile?.username}</p>
          </div>
        </div>
        <button className="w-12 h-12 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: "hsl(var(--online))" }} />
        </button>
      </div>

      {/* Search */}
      <button onClick={() => nav("/discover")} className="w-full flex items-center gap-3 bg-white rounded-full px-5 h-14 shadow-[var(--shadow-pill)] mb-6">
        <Search className="w-5 h-5 text-muted-foreground" />
        <span className="text-muted-foreground">Let's find a match</span>
      </button>

      {/* People stories */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 mb-6">
        {people.map((p) => (
          <button key={p.id} onClick={() => nav(`/chat/new/${p.id}`)} className="ring-dashed shrink-0">
            <Avatar className="w-16 h-16">
              <AvatarImage src={p.avatar_url || undefined} />
              <AvatarFallback>{p.name?.[0]}</AvatarFallback>
            </Avatar>
          </button>
        ))}
      </div>

      <h2 className="text-xl font-bold mb-4">Upcoming Meetings</h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          { name: "Design Team Meeting", time: "Today 4:30 pm", end: "6:00 pm", c: "hsl(25 90% 92%)" },
          { name: "Messaging Meeting", time: "Today 7:30 pm", end: "5:00 pm", c: "hsl(200 80% 92%)" },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-3xl p-4 shadow-[var(--shadow-soft)]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: m.c }}>
              <Calendar className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm mb-3">{m.name}</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{m.time}</span><span>{m.end}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold">Featured</h2>
        <button className="text-sm text-muted-foreground">View All</button>
      </div>
      <div className="rounded-3xl p-5 shadow-[var(--shadow-bubble)]" style={{ background: "var(--gradient-card)" }}>
        <div className="flex justify-between items-start mb-4">
          <button className="bg-white rounded-full px-5 py-2 text-sm font-semibold">Join</button>
          <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-3">
          <Avatar className="w-14 h-14">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>D</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Design Team Meeting</h3>
            <p className="text-sm text-foreground/80">Participants, including key team members and the team lead, will collaborate to assess feedback.</p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

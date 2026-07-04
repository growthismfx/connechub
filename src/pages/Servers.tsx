import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Hash, Users, Globe, Search } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

type Server = {
  id: string; name: string; description: string | null; icon_url: string | null;
  banner_url: string | null; is_public: boolean; invite_code: string; member_count: number; owner_id: string;
};

export default function Servers() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mine, setMine] = useState<Server[]>([]);
  const [discover, setDiscover] = useState<Server[]>([]);
  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: mineRows } = await supabase
      .from("server_members")
      .select("server_id, servers(*)")
      .eq("user_id", user.id);
    setMine(((mineRows || []) as any[]).map((r) => r.servers).filter(Boolean));
    const { data: pub } = await supabase
      .from("servers")
      .select("*")
      .eq("is_public", true)
      .order("member_count", { ascending: false })
      .limit(50);
    setDiscover((pub as any) || []);
  };

  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !name.trim()) return;
    const { data, error } = await supabase
      .from("servers")
      .insert({ name: name.trim(), description: desc.trim() || null, is_public: isPublic, owner_id: user.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setOpen(false); setName(""); setDesc("");
    toast.success("Server created");
    nav(`/servers/${data.id}`);
  };

  const join = async (server: Server) => {
    if (!user) return;
    const { error } = await supabase.from("server_members").insert({ server_id: server.id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    nav(`/servers/${server.id}`);
  };

  const joinByCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    const { data } = await supabase.from("servers").select("*").eq("invite_code", code).maybeSingle();
    if (!data) return toast.error("Invalid invite");
    await join(data as any);
    setJoinCode("");
  };

  const list = tab === "mine" ? mine : discover.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen pb-20 bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Servers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Create</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Server</DialogTitle></DialogHeader>
            <Input placeholder="Server name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public (discoverable)
            </label>
            <Button onClick={create}>Create</Button>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">Or join with invite code</p>
              <div className="flex gap-2">
                <Input placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                <Button variant="secondary" onClick={joinByCode}>Join</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Button variant={tab === "mine" ? "default" : "secondary"} size="sm" onClick={() => setTab("mine")}>My Servers</Button>
          <Button variant={tab === "discover" ? "default" : "secondary"} size="sm" onClick={() => setTab("discover")}>
            <Globe className="w-4 h-4 mr-1" />Discover
          </Button>
        </div>

        {tab === "discover" && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search public servers..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}

        <div className="grid gap-3">
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => tab === "mine" ? nav(`/servers/${s.id}`) : join(s)}
              className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 text-left transition"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                {s.icon_url ? <img src={s.icon_url} className="w-full h-full object-cover" /> : s.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-2">
                  {s.name}
                  {s.is_public && <Globe className="w-3 h-3 text-muted-foreground" />}
                </div>
                {s.description && <div className="text-sm text-muted-foreground truncate">{s.description}</div>}
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" />{s.member_count} members
                </div>
              </div>
              {tab === "discover" && <Button size="sm" variant="secondary">Join</Button>}
            </button>
          ))}
          {list.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Hash className="w-12 h-12 mx-auto opacity-30 mb-3" />
              <p>{tab === "mine" ? "No servers yet. Create one or discover public servers." : "No public servers found."}</p>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

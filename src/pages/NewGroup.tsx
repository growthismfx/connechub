import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Check, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function NewGroup() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<"members" | "details">("members");
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [name, setName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      let query = supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .neq("id", user.id)
        .limit(50);
      if (q.trim()) query = query.or(`username.ilike.%${q}%,name.ilike.%${q}%`);
      const { data } = await query;
      setPeople(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user]);

  const toggle = (p: any) => {
    setSelected((s) => {
      const n = { ...s };
      if (n[p.id]) delete n[p.id]; else n[p.id] = p;
      return n;
    });
  };

  const onAvatar = (f: File) => {
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const create = async () => {
    if (!user) return;
    const ids = Object.keys(selected);
    if (!ids.length) return toast.error("Add at least one member");
    if (!name.trim()) return toast.error("Give the group a name");
    setCreating(true);
    try {
      let avatar_url: string | null = null;
      if (avatarFile) {
        const path = `${user.id}/group-${Date.now()}-${avatarFile.name}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from("avatars").getPublicUrl(path);
          avatar_url = data.publicUrl;
        }
      }
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ created_by: user.id, is_group: true, name: name.trim(), avatar_url })
        .select("id")
        .single();
      if (error || !conv) throw error;
      const parts = [
        { conversation_id: conv.id, user_id: user.id, role: "admin" },
        ...ids.map((uid) => ({ conversation_id: conv.id, user_id: uid, role: "member" })),
      ];
      const { error: pErr } = await supabase.from("conversation_participants").insert(parts);
      if (pErr) throw pErr;
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: `${name.trim()} group created`,
        message_type: "system",
      });
      nav(`/chat/${conv.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Could not create group");
    } finally {
      setCreating(false);
    }
  };

  const selectedList = Object.values(selected);

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => (step === "details" ? setStep("members") : nav(-1))} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{step === "members" ? "New group" : "Group details"}</h1>
          <p className="text-xs text-muted-foreground">
            {step === "members" ? `${selectedList.length} selected` : `${selectedList.length} members`}
          </p>
        </div>
      </div>

      {step === "members" && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or @username"
              className="h-14 rounded-full pl-14 bg-white border-0 shadow-[var(--shadow-pill)]"
            />
          </div>

          {selectedList.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
              {selectedList.map((p: any) => (
                <button key={p.id} onClick={() => toggle(p)} className="shrink-0 flex flex-col items-center w-16">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback>{p.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <p className="text-xs mt-1 truncate w-full text-center">{p.name?.split(" ")[0]}</p>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {people.map((p) => {
              const isSel = !!selected[p.id];
              return (
                <button key={p.id} onClick={() => toggle(p)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback>{p.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {isSel && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                </button>
              );
            })}
            {!people.length && <p className="text-center text-sm text-muted-foreground py-8">No people found</p>}
          </div>

          {selectedList.length > 0 && (
            <button
              onClick={() => setStep("details")}
              className="fixed bottom-6 right-5 h-14 px-6 rounded-full shadow-[var(--shadow-pill)] font-semibold flex items-center gap-2"
              style={{ background: "var(--gradient-cta)" }}
            >
              Next <Check className="w-4 h-4" />
            </button>
          )}
        </>
      )}

      {step === "details" && (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3">
            <label className="relative cursor-pointer">
              <Avatar className="w-28 h-28">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback><Users className="w-10 h-10 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[var(--shadow-pill)]">
                <Camera className="w-4 h-4" />
              </span>
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
            </label>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={50}
            className="h-14 rounded-full bg-white border-0 shadow-[var(--shadow-pill)] text-center text-base"
          />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-2">Members · {selectedList.length}</p>
            <div className="space-y-2">
              {selectedList.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-[var(--shadow-soft)]">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback>{p.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={create}
            disabled={creating || !name.trim()}
            className="fixed bottom-6 right-5 h-14 px-6 rounded-full shadow-[var(--shadow-pill)] font-semibold flex items-center gap-2 disabled:opacity-50"
            style={{ background: "var(--gradient-cta)" }}
          >
            {creating ? "Creating…" : "Create group"}
          </button>
        </div>
      )}
    </div>
  );
}

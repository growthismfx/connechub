import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function UsernameSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<null | boolean>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!username || username.length < 3) { setAvailable(null); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { setAvailable(false); return; }
    setChecking(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setAvailable(!data);
      setChecking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const save = async () => {
    if (!available || !user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    setShowNumber(true);
  };

  const copyNumber = () => {
    const num = `${profile?.country_code}${profile?.assigned_number}`;
    navigator.clipboard.writeText(num);
    toast.success("Copied!");
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-16">
      <h1 className="text-3xl font-bold mb-2">Pick a username</h1>
      <p className="text-muted-foreground mb-8">This is how friends will find you.</p>

      <div className="relative">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
          placeholder="your_username"
          className="h-14 rounded-full px-6 pr-12 bg-white border-0 shadow-[var(--shadow-pill)] text-base"
          maxLength={20}
        />
        <div className="absolute right-5 top-1/2 -translate-y-1/2">
          {checking && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {!checking && available === true && <Check className="w-5 h-5" style={{ color: "hsl(var(--online))" }} />}
          {!checking && available === false && <X className="w-5 h-5 text-destructive" />}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 px-2">3–20 chars. Letters, numbers, underscore.</p>

      <Button
        onClick={save}
        disabled={!available || saving}
        className="mt-8 h-14 rounded-full text-foreground border-0 shadow-[var(--shadow-pill)] font-semibold"
        style={{ background: "var(--gradient-cta)" }}
      >
        {saving ? "Saving..." : "Continue"}
      </Button>

      <Dialog open={showNumber} onOpenChange={(o) => { if (!o) navigate("/"); }}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">🎉 Welcome!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">Your unique number</p>
            <div className="rounded-2xl py-6 px-4 mb-4" style={{ background: "var(--gradient-card)" }}>
              <p className="text-3xl font-bold tracking-wider">{profile?.country_code} {profile?.assigned_number}</p>
            </div>
            <Button onClick={copyNumber} variant="ghost" className="rounded-full">
              <Copy className="w-4 h-4 mr-2" /> Copy number
            </Button>
            <Button onClick={() => navigate("/")} className="w-full mt-4 h-12 rounded-full text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>
              Get started
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

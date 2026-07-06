import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Fingerprint } from "lucide-react";
import { toast } from "sonner";

async function hashPasscode(code: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(code), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UNLOCK_KEY = "hellow.unlocked_at";
const UNLOCK_TTL_MS = 5 * 60 * 1000; // stay unlocked for 5 min in same tab

export default function AppLock() {
  const { user } = useAuth();
  const [sec, setSec] = useState<any>(null);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) { setLocked(false); return; }
    (async () => {
      const { data } = await supabase.from("user_security").select("*").eq("user_id", user.id).maybeSingle();
      setSec(data);
      if (data?.passcode_enabled && data.passcode_hash) {
        const last = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
        if (Date.now() - last > UNLOCK_TTL_MS) setLocked(true);
      }
    })();
  }, [user]);

  // Re-lock when tab regains focus after being hidden for a while
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && sec?.passcode_enabled) {
        const last = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
        if (Date.now() - last > UNLOCK_TTL_MS) setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [sec]);

  const unlock = async () => {
    if (!sec?.passcode_hash) return;
    setChecking(true);
    const [salt, expected] = sec.passcode_hash.split(":");
    const got = await hashPasscode(pin, salt);
    setChecking(false);
    if (got === expected) {
      sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
      setLocked(false); setPin("");
    } else {
      toast.error("Wrong passcode");
      setPin("");
    }
  };

  const useBiometric = async () => {
    const creds = (sec?.biometric_credentials || []) as any[];
    if (!creds.length) { toast.error("No biometric enrolled"); return; }
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: creds.map((c) => ({
            id: Uint8Array.from(atob(c.id.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
            type: "public-key" as const,
          })),
          userVerification: "required",
          timeout: 60000,
        },
      });
      sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
      setLocked(false);
    } catch { toast.error("Biometric failed"); }
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center px-6 gap-6">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-10 h-10 text-primary" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold">App locked</h1>
        <p className="text-sm text-muted-foreground">Enter your passcode to continue</p>
      </div>
      <Input
        autoFocus
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        onKeyDown={(e) => e.key === "Enter" && unlock()}
        placeholder="••••"
        className="max-w-xs rounded-full h-12 text-center text-2xl tracking-[0.5em]"
      />
      <div className="flex gap-2">
        <Button onClick={unlock} disabled={pin.length < 4 || checking} className="rounded-full px-8">
          Unlock
        </Button>
        {(sec?.biometric_credentials?.length || 0) > 0 && (
          <Button onClick={useBiometric} variant="outline" className="rounded-full" size="icon">
            <Fingerprint className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Shield, Smartphone, KeyRound, Fingerprint, Bell, LogOut, ArrowLeft,
  Copy, AlertTriangle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import BottomNav from "@/components/BottomNav";

// --- Crypto helpers for passcode hashing (PBKDF2) ---
async function hashPasscode(code: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(code), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomSalt() { return crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), ""); }
function genRecoveryCodes() {
  return Array.from({ length: 8 }, () => Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().match(/.{1,4}/g)!.join("-"));
}

export default function SecuritySettings() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [sec, setSec] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // TOTP
  const [totpOpen, setTotpOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQr, setTotpQr] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);

  // Passcode
  const [passOpen, setPassOpen] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: s }, { data: d }, { data: a }] = await Promise.all([
      supabase.from("user_security").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_devices").select("*").eq("user_id", user.id).order("last_active", { ascending: false }),
      supabase.from("login_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setSec(s); setDevices(d || []); setAlerts(a || []);
  };

  // Register current device
  useEffect(() => {
    if (!user) return;
    load();
    (async () => {
      const fp = navigator.userAgent.slice(0, 64);
      const existing = await supabase.from("user_devices").select("id").eq("user_id", user.id).eq("user_agent", fp).maybeSingle();
      if (!existing.data) {
        await supabase.from("user_devices").insert({
          user_id: user.id, user_agent: fp, platform: navigator.platform,
          device_name: /Mobile|Android|iPhone/.test(navigator.userAgent) ? "Mobile" : "Desktop",
        });
        await supabase.from("login_alerts").insert({ user_id: user.id, event: "new_device", device: fp });
        load();
      } else {
        await supabase.from("user_devices").update({ last_active: new Date().toISOString() }).eq("id", existing.data.id);
      }
    })();
  }, [user?.id]);

  // ---- TOTP ----
  const startTotpSetup = async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: "hellow", label: user?.email || "user", secret });
    const uri = totp.toString();
    const qr = await QRCode.toDataURL(uri);
    setTotpSecret(secret.base32);
    setTotpQr(qr);
    setTotpCode("");
    setRecovery([]);
    setTotpOpen(true);
  };

  const verifyAndEnableTotp = async () => {
    if (!user) return;
    const totp = new OTPAuth.TOTP({ issuer: "hellow", label: user.email || "user", secret: OTPAuth.Secret.fromBase32(totpSecret) });
    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) return toast.error("Invalid code, try again");
    const codes = genRecoveryCodes();
    await supabase.from("user_security").upsert({
      user_id: user.id, totp_secret: totpSecret, totp_enabled: true, recovery_codes: codes,
    });
    setRecovery(codes);
    await supabase.from("login_alerts").insert({ user_id: user.id, event: "totp_enabled" });
    toast.success("Two-factor enabled");
    load();
  };

  const disableTotp = async () => {
    if (!user) return;
    await supabase.from("user_security").update({ totp_enabled: false, totp_secret: null, recovery_codes: [] }).eq("user_id", user.id);
    await supabase.from("login_alerts").insert({ user_id: user.id, event: "totp_disabled" });
    toast.success("Two-factor disabled"); load();
  };

  // ---- Passcode ----
  const setPasscode = async () => {
    if (!user) return;
    if (pin1.length < 4) return toast.error("PIN must be 4+ digits");
    if (pin1 !== pin2) return toast.error("PINs don't match");
    const salt = randomSalt();
    const hash = await hashPasscode(pin1, salt);
    await supabase.from("user_security").upsert({
      user_id: user.id, passcode_hash: `${salt}:${hash}`, passcode_enabled: true,
    });
    localStorage.setItem("hellow_locked", "0");
    toast.success("Passcode set"); setPin1(""); setPin2(""); setPassOpen(false); load();
  };
  const disablePasscode = async () => {
    if (!user) return;
    await supabase.from("user_security").update({ passcode_enabled: false, passcode_hash: null }).eq("user_id", user.id);
    toast.success("Passcode removed"); load();
  };

  // ---- WebAuthn (biometric) ----
  const enableBiometric = async () => {
    if (!user) return toast.error("Sign in required");
    if (!(window as any).PublicKeyCredential) return toast.error("Biometric not supported in this browser");
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge, rp: { name: "hellow" },
          user: { id: new TextEncoder().encode(user.id), name: user.email || user.id, displayName: user.email || "user" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { userVerification: "required", authenticatorAttachment: "platform" },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;
      if (!cred) throw new Error("Cancelled");
      const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      const existing = (sec?.biometric_credentials || []) as any[];
      await supabase.from("user_security").upsert({
        user_id: user.id, biometric_credentials: [...existing, { id: credId, created_at: new Date().toISOString() }],
      });
      toast.success("Biometric enrolled"); load();
    } catch (e: any) { toast.error(e.message || "Failed to enroll"); }
  };

  const removeDevice = async (id: string) => {
    if (!user) return;
    await supabase.from("user_devices").delete().eq("id", id);
    toast.success("Device removed"); load();
  };

  const toggleAlerts = async (on: boolean) => {
    if (!user) return;
    await supabase.from("user_security").upsert({ user_id: user.id, login_alerts_enabled: on });
    load();
  };

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-bold">Security</h1>
      </div>

      {/* 2FA */}
      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-cta)" }}><Shield className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">Two-factor authentication</p>
            <p className="text-xs text-muted-foreground">{sec?.totp_enabled ? "Enabled — TOTP authenticator" : "Add an extra layer of security"}</p>
          </div>
          {sec?.totp_enabled
            ? <Button variant="outline" size="sm" onClick={disableTotp}>Disable</Button>
            : <Button size="sm" onClick={startTotpSetup} style={{ background: "var(--gradient-cta)" }} className="text-white border-0">Enable</Button>}
        </div>
      </div>

      {/* Passcode */}
      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">App passcode</p>
            <p className="text-xs text-muted-foreground">{sec?.passcode_enabled ? "Active — required to open the app" : "Lock the app behind a PIN"}</p>
          </div>
          {sec?.passcode_enabled
            ? <Button variant="outline" size="sm" onClick={disablePasscode}>Remove</Button>
            : <Button size="sm" onClick={() => setPassOpen(true)}>Set</Button>}
        </div>
      </div>

      {/* Biometric */}
      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Fingerprint className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">Biometric unlock</p>
            <p className="text-xs text-muted-foreground">{(sec?.biometric_credentials?.length || 0)} device{(sec?.biometric_credentials?.length || 0) !== 1 ? "s" : ""} enrolled · Face ID / fingerprint</p>
          </div>
          <Button size="sm" onClick={enableBiometric}>Add</Button>
        </div>
      </div>

      {/* Login alerts */}
      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Bell className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">Login alerts</p>
            <p className="text-xs text-muted-foreground">Notify me about new sign-ins</p>
          </div>
          <Switch checked={!!sec?.login_alerts_enabled} onCheckedChange={toggleAlerts} />
        </div>
        {alerts.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto border-t pt-3">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                <span className="flex-1 capitalize">{a.event.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Devices */}
      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><Smartphone className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-semibold">Active devices</p>
            <p className="text-xs text-muted-foreground">{devices.length} device{devices.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-2 border-t">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{d.device_name || d.platform || "Device"}</p>
                <p className="text-xs text-muted-foreground truncate">{d.user_agent}</p>
                <p className="text-[10px] text-muted-foreground">Last active {formatDistanceToNow(new Date(d.last_active), { addSuffix: true })}</p>
              </div>
              <button onClick={() => removeDevice(d.id)} className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* TOTP setup dialog */}
      <Dialog open={totpOpen} onOpenChange={setTotpOpen}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Set up 2FA</DialogTitle></DialogHeader>
          {recovery.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">Scan with Google Authenticator, 1Password, Authy…</p>
              {totpQr && <img src={totpQr} alt="QR" className="mx-auto rounded-xl border" />}
              <div className="text-xs text-center font-mono bg-muted rounded-lg p-2 break-all">{totpSecret}</div>
              <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="rounded-full h-11 text-center text-lg tracking-widest" />
              <Button onClick={verifyAndEnableTotp} disabled={totpCode.length !== 6} className="w-full rounded-full h-11 text-white border-0" style={{ background: "var(--gradient-cta)" }}>Verify & enable</Button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-amber-600">Save these recovery codes</p>
              <p className="text-xs text-muted-foreground">Use them if you lose your authenticator. Each works once.</p>
              <div className="bg-muted rounded-xl p-3 grid grid-cols-2 gap-2 text-xs font-mono">
                {recovery.map((c) => <div key={c}>{c}</div>)}
              </div>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(recovery.join("\n")); toast.success("Copied"); }} className="rounded-full">
                <Copy className="w-4 h-4 mr-1" /> Copy all
              </Button>
              <Button onClick={() => setTotpOpen(false)} className="rounded-full text-white border-0" style={{ background: "var(--gradient-cta)" }}>Done</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Passcode dialog */}
      <Dialog open={passOpen} onOpenChange={setPassOpen}>
        <DialogContent className="rounded-3xl border-0 max-w-sm">
          <DialogHeader><DialogTitle>Set passcode</DialogTitle></DialogHeader>
          <Input type="password" inputMode="numeric" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="New passcode (4-8 digits)" className="rounded-full h-11 text-center text-lg tracking-widest" />
          <Input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Confirm" className="rounded-full h-11 text-center text-lg tracking-widest" />
          <Button onClick={setPasscode} className="w-full rounded-full h-11 text-white border-0" style={{ background: "var(--gradient-cta)" }}>Save</Button>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

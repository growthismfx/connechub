import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ChevronRight, User, Bell, Lock, HelpCircle, LogOut, Copy, Edit3, Palette, Camera, Languages, Settings as SettingsIcon, Shield, UserCog, StickyNote, Circle } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ensureBrowserNotificationPermission, getBrowserNotificationsEnabled, setBrowserNotificationsEnabled } from "@/lib/browserNotifications";
import { subscribeToPush, unsubscribeFromPush, getPushEnabled, isPushSupported, ensurePushReady } from "@/lib/pushNotifications";
import InstallAppButton from "@/components/InstallAppButton";
import CountryCodePicker from "@/components/CountryCodePicker";
import { useTheme, THEMES } from "@/contexts/ThemeContext";

export default function Settings() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  const { theme, setTheme } = useTheme();
  const number = `${profile?.country_code || ""}${profile?.assigned_number || ""}`;
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(profile?.name || "");
  const [status, setStatus] = useState(profile?.status || "");
  const [countryCode, setCountryCode] = useState(profile?.country_code || "+1");
  const [notifications, setNotifications] = useState(getBrowserNotificationsEnabled());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile?.name || "");
    setStatus(profile?.status || "");
    setCountryCode(profile?.country_code || "+1");
  }, [profile]);

  const onAvatarChange = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const supported = await isPushSupported();
      setPushSupported(supported);
      const enabled = await getPushEnabled();
      setPushEnabled(enabled);
    })();
  }, []);

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const r = await subscribeToPush({ forceRefresh: true });
      if (!r.ok) {
        if (r.reason === "preview") toast.error("Push only works on the published app, not the editor preview");
        else if (r.reason === "denied") toast.error("Permission denied. Allow notifications in browser settings.");
        else if (r.reason === "unsupported") toast.error("Your browser does not support push notifications");
        else toast.error("Could not enable push: " + (r.reason || "unknown"));
        setPushEnabled(false);
        return;
      }
      setPushEnabled(true);
      toast.success("Push notifications enabled");
    } else {
      await unsubscribeFromPush();
      setPushEnabled(false);
      toast.success("Push notifications disabled");
    }
  };

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name, status, country_code: countryCode }).eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile updated");
    setEditOpen(false);
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      const result = await ensureBrowserNotificationPermission();
      if (!result.supported) {
        toast.error("Browser notifications are not supported here");
        setNotifications(false);
        return;
      }
      if (!result.granted) {
        toast.error("Allow browser notifications to get message and call alerts");
        setNotifications(false);
        setBrowserNotificationsEnabled(false);
        return;
      }

      const pushResult = await ensurePushReady();
      if (pushResult.ok) {
        setPushEnabled(true);
      }
    }

    setNotifications(enabled);
    setBrowserNotificationsEnabled(enabled);
    toast.success(enabled ? "Notifications enabled" : "Notifications disabled");
  };

  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = (k: string) => setOpenKey(openKey === k ? null : k);

  const NavRow = ({ icon: Icon, label, k }: any) => {
    const open = openKey === k;
    return (
      <button
        onClick={() => toggle(k)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors"
      >
        <Icon className="w-[18px] h-[18px] text-muted-foreground" />
        <span className="flex-1 text-[15px] font-medium">{label}</span>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
    );
  };

  const Panel = ({ k, children }: any) =>
    openKey === k ? <div className="px-5 pb-4 animate-fade-in space-y-3">{children}</div> : null;

  const Toggle = ({ label, sub, checked, onChange, disabled }: any) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );


  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <div className="flex items-center justify-between mb-2 animate-fade-in">
        <h1 className="text-[26px] font-bold tracking-tight">Profile</h1>
        <button onClick={() => nav("/settings/profile")} className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center justify-center">
          <Edit3 className="w-4 h-4" />
        </button>
      </div>

      {/* Centered profile header */}
      <div className="flex flex-col items-center text-center mb-8 animate-scale-in">
        <button onClick={() => fileRef.current?.click()} className="relative shrink-0" disabled={uploading}>
          <Avatar className="w-28 h-28 ring-4 ring-white shadow-[var(--shadow-bubble)]">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-3xl">{profile?.name?.[0]}</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-[var(--shadow-pill)]" style={{ background: "var(--gradient-cta)" }}>
            <Camera className="w-3.5 h-3.5" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onAvatarChange(e.target.files[0])} />
        <p className="font-bold text-xl mt-4">{profile?.name}</p>
        <p className="text-sm text-muted-foreground">@{profile?.username}</p>
        {profile?.status && <p className="text-sm mt-2">{profile.status}</p>}
      </div>

      <div className="bg-white rounded-3xl shadow-[var(--shadow-soft)] divide-y divide-border/50 overflow-hidden mb-6 animate-fade-in">
        <button onClick={() => nav("/settings/profile")} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors">
          <UserCog className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Edit profile</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => nav("/settings/security")} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors">
          <Shield className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Security & devices</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <NavRow icon={User} label="Account" k="account" />
        <Panel k="account">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Phone</p>
              <p className="text-xs text-muted-foreground">{number}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(number); toast.success("Copied"); }} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><Copy className="w-4 h-4" /></button>
          </div>
          <div className="py-2">
            <p className="text-sm font-medium">Username</p>
            <p className="text-xs text-muted-foreground">@{profile?.username}</p>
          </div>
        </Panel>

        <button onClick={() => nav("/settings/privacy")} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors">
          <Lock className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Privacy</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => nav("/settings/notes")} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors">
          <StickyNote className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Notes</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => nav("/settings/status")} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors">
          <Circle className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Status</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>


        <NavRow icon={Bell} label="Notifications" k="notif" />
        <Panel k="notif">
          <Toggle label="In-app alerts" sub="Show alerts while open" checked={notifications} onChange={handleNotificationsToggle} />
          <Toggle label="Push notifications" sub={pushSupported ? "Alerts when app is closed" : "Not supported here"} checked={pushEnabled} onChange={handlePushToggle} disabled={!pushSupported} />
        </Panel>

        <button onClick={() => nav("/settings/appearance")} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/40 transition-colors">
          <Palette className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Appearance & wallpaper</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        <NavRow icon={Languages} label="Language" k="lang" />
        <Panel k="lang">
          <p className="text-sm text-muted-foreground">English (US) — more languages coming soon.</p>
        </Panel>

        <NavRow icon={HelpCircle} label="Help & Support" k="help" />
        <Panel k="help">
          <p className="text-sm text-muted-foreground mb-2">Need a hand? We're here for you.</p>
          <a href="mailto:support@hellow.app" className="text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>support@hellow.app</a>
        </Panel>

        <NavRow icon={SettingsIcon} label="Install App" k="install" />
        <Panel k="install">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Add hellow to your home screen.</p>
            <InstallAppButton />
          </div>
        </Panel>
      </div>

      <Button onClick={signOut} variant="ghost" className="w-full rounded-full text-destructive">
        <LogOut className="w-4 h-4 mr-2" /> Sign out
      </Button>


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl border-0">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-full h-12 mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">About</label>
              <Input value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full h-12 mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Country</label>
              <div className="mt-1"><CountryCodePicker value={countryCode} onChange={setCountryCode} /></div>
            </div>
            <Button onClick={save} className="w-full rounded-full h-12 text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

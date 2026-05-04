import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ChevronRight, User, Bell, Lock, HelpCircle, LogOut, Copy, Edit3, Moon, Palette } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ensureBrowserNotificationPermission, getBrowserNotificationsEnabled, setBrowserNotificationsEnabled } from "@/lib/browserNotifications";

export default function Settings() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  const number = `${profile?.country_code || ""}${profile?.assigned_number || ""}`;
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(profile?.name || "");
  const [status, setStatus] = useState(profile?.status || "");
  const [notifications, setNotifications] = useState(getBrowserNotificationsEnabled());
  const [readReceipts, setReadReceipts] = useState(true);
  const [showOnline, setShowOnline] = useState(true);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name, status }).eq("id", user.id);
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
    }

    setNotifications(enabled);
    setBrowserNotificationsEnabled(enabled);
    toast.success(enabled ? "Notifications enabled" : "Notifications disabled");
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">{title}</p>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] divide-y divide-border/50">{children}</div>
    </div>
  );

  const Row = ({ icon: Icon, label, sub, action, onClick }: any) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 text-left">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-card)" }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      {action || <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="min-h-screen pb-32 px-5 pt-12">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Profile card */}
      <div className="bg-white rounded-3xl p-5 shadow-[var(--shadow-soft)] mb-6 flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xl">{profile?.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg truncate">{profile?.name}</p>
          <p className="text-xs text-muted-foreground truncate">@{profile?.username}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.status}</p>
        </div>
        <button onClick={() => setEditOpen(true)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-cta)" }}>
          <Edit3 className="w-4 h-4" />
        </button>
      </div>

      <Section title="Account">
        <Row icon={User} label="Phone number" sub={number} action={
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(number); toast.success("Copied"); }} className="p-1"><Copy className="w-4 h-4 text-muted-foreground" /></button>
        } />
        <Row icon={User} label="Username" sub={`@${profile?.username}`} />
      </Section>

      <Section title="Privacy">
        <Row icon={Lock} label="Read receipts" sub="Show when you've read messages" action={<Switch checked={readReceipts} onCheckedChange={setReadReceipts} />} />
        <Row icon={User} label="Online status" sub="Show when you're online" action={<Switch checked={showOnline} onCheckedChange={setShowOnline} />} />
      </Section>

      <Section title="Notifications">
        <Row icon={Bell} label="Push notifications" action={<Switch checked={notifications} onCheckedChange={handleNotificationsToggle} />} />
      </Section>

      <Section title="Appearance">
        <Row icon={Palette} label="Theme" sub="Light" />
        <Row icon={Moon} label="Dark mode" action={<Switch />} />
      </Section>

      <Section title="Support">
        <Row icon={HelpCircle} label="Help & FAQ" />
      </Section>

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
            <Button onClick={save} className="w-full rounded-full h-12 text-foreground border-0" style={{ background: "var(--gradient-cta)" }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

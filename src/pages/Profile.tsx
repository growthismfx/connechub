import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

export default function Profile() {
  const { profile, signOut } = useAuth();
  const number = `${profile?.country_code || ""}${profile?.assigned_number || ""}`;
  return (
    <div className="min-h-screen pb-32 px-5 pt-16 text-center">
      <Avatar className="w-28 h-28 mx-auto mb-4 ring-4 ring-white shadow-[var(--shadow-soft)]">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback className="text-3xl">{profile?.name?.[0]}</AvatarFallback>
      </Avatar>
      <h1 className="text-2xl font-bold">{profile?.name}</h1>
      <p className="text-muted-foreground mb-6">@{profile?.username}</p>

      <div className="rounded-3xl p-5 mb-4 mx-auto max-w-sm" style={{ background: "var(--gradient-card)" }}>
        <p className="text-xs text-muted-foreground mb-1">Your unique number</p>
        <p className="text-2xl font-bold tracking-wider">{number}</p>
        <Button variant="ghost" size="sm" className="mt-2 rounded-full" onClick={() => { navigator.clipboard.writeText(number); toast.success("Copied"); }}>
          <Copy className="w-4 h-4 mr-1" /> Copy
        </Button>
      </div>

      <div className="bg-white rounded-3xl p-5 mb-4 max-w-sm mx-auto text-left shadow-[var(--shadow-soft)]">
        <p className="text-xs text-muted-foreground">Status</p>
        <p>{profile?.status}</p>
      </div>

      <Button onClick={signOut} variant="ghost" className="rounded-full text-destructive">
        <LogOut className="w-4 h-4 mr-2" /> Sign out
      </Button>

      <BottomNav />
    </div>
  );
}

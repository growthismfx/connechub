import { useAuth } from "@/hooks/useAuth";
import Auth from "./Auth";
import UsernameSetup from "./UsernameSetup";
import Home from "./Home";

export default function Index() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Auth />;
  if (!profile?.username) return <UsernameSetup />;
  return <Home />;
}

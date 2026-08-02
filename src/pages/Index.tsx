import { useAuth } from "@/hooks/useAuth";
import Landing from "./Landing";
import UsernameSetup from "./UsernameSetup";
import Chats from "./Chats";

export default function Index() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Landing />;
  if (!profile?.username) return <UsernameSetup />;
  return <Chats />;
}

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  assigned_number: string | null;
  country_code: string | null;
  avatar_url: string | null;
  status: string | null;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({} as Ctx);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => loadProfile(s.user.id), 0);
      else setProfile(null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Presence: mark online while mounted
  useEffect(() => {
    if (!user) return;
    const setOnline = (online: boolean) =>
      supabase.from("profiles").update({ is_online: online, last_seen: new Date().toISOString() }).eq("id", user.id);
    setOnline(true);
    const onUnload = () => { setOnline(false); };
    window.addEventListener("beforeunload", onUnload);
    const iv = setInterval(() => setOnline(true), 30000);
    return () => { window.removeEventListener("beforeunload", onUnload); clearInterval(iv); setOnline(false); };
  }, [user]);

  return (
    <AuthCtx.Provider value={{
      user, session, profile, loading,
      refreshProfile: async () => user && loadProfile(user.id),
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);

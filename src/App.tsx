import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Chats from "./pages/Chats";
import Chat from "./pages/Chat";
import StartChat from "./pages/StartChat";
import Discover from "./pages/Discover";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: JSX.Element }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (!profile?.username) return <Navigate to="/" replace />;
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/chats" element={<Protected><Chats /></Protected>} />
            <Route path="/chat/new/:userId" element={<Protected><StartChat /></Protected>} />
            <Route path="/chat/:id" element={<Protected><Chat /></Protected>} />
            <Route path="/discover" element={<Protected><Discover /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

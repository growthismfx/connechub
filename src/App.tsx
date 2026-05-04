import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Chats from "./pages/Chats";
import Chat from "./pages/Chat";
import StartChat from "./pages/StartChat";
import Discover from "./pages/Discover";
import Status from "./pages/Status";
import Calls from "./pages/Calls";
import Settings from "./pages/Settings";
import Requests from "./pages/Requests";

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
            <Route path="/auth" element={<Auth />} />
            <Route path="/chats" element={<Protected><Chats /></Protected>} />
            <Route path="/chat/new/:userId" element={<Protected><StartChat /></Protected>} />
            <Route path="/chat/:id" element={<Protected><Chat /></Protected>} />
            <Route path="/discover" element={<Protected><Discover /></Protected>} />
            <Route path="/status" element={<Protected><Status /></Protected>} />
            <Route path="/calls" element={<Protected><Calls /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/requests" element={<Protected><Requests /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";

// Lazy-load route components so the heavy charts/forms aren't in the entry chunk.
const Generator = lazy(() => import("./pages/Generator"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin(user?.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background" dir="rtl">
      {user && <AppSidebar isAdmin={isAdmin} />}
      <main className="flex-1 w-full">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/auth" element={user ? <Navigate to="/" /> : <Auth />} />
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Generator />
                </AuthGuard>
              }
            />
            <Route
              path="/campaigns"
              element={
                <AuthGuard>
                  <Campaigns />
                </AuthGuard>
              }
            />
            <Route
              path="/analytics"
              element={
                <AuthGuard>
                  <Analytics />
                </AuthGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthGuard>
                  <Settings />
                </AuthGuard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AuthGuard requireAdmin>
                  <AdminUsers />
                </AuthGuard>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
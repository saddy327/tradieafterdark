import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Navbar from "@/components/navbar";

import Home from "@/pages/home";
import SearchPage from "@/pages/search";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import TradieProfilePage from "@/pages/tradie-profile";
import JobsPage from "@/pages/jobs";
import JobDetailPage from "@/pages/job-detail";
import OnboardingPage from "@/pages/onboarding";
import TradieDashboard from "@/pages/tradie-dashboard";
import AdminDashboardPage from "@/pages/admin/index";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/tradie/:slug" component={TradieProfilePage} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/jobs/:jobId" component={JobDetailPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/tradie/dashboard" component={TradieDashboard} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout() {
  return (
    <div className="dark">
      <Navbar />
      <AppRoutes />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Layout />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

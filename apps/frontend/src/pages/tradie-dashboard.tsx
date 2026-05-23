import { useGetMyProfile, useGetTradieStats, useGetSubscription, getGetMyProfileQueryKey, getGetTradieStatsQueryKey, getGetSubscriptionQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Star, Briefcase, Clock, TrendingUp, Settings, CreditCard, Eye, AlertTriangle } from "lucide-react";

export default function TradieDashboard() {
  const { user } = useAuth();

  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), staleTime: 60_000 },
  });

  const { data: stats } = useGetTradieStats({
    query: { queryKey: getGetTradieStatsQueryKey(), staleTime: 60_000 },
  });

  const { data: sub } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey(), staleTime: 60_000 },
  });

  const p = profile as any;
  const s = stats as any;
  const subscription = sub as any;

  return (
    <div className="min-h-screen bg-background text-foreground dark py-10">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-dashboard">
              {p?.displayName || "Dashboard"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1" data-testid="text-dashboard-email">
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {p?.isLive ? (
              <Badge className="bg-green-500/10 text-green-400 border-green-500/30" data-testid="badge-live-status">
                <Eye className="w-3 h-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30" data-testid="badge-not-live-status">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Not live
              </Badge>
            )}
            <Button variant="outline" size="sm" asChild data-testid="button-view-profile">
              <Link to={`/tradie/${p?.slug}`}>View Profile</Link>
            </Button>
          </div>
        </div>

        {/* Verification status */}
        {!p?.isLive && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5 mb-6" data-testid="alert-not-live">
            <h3 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Your profile isn&apos;t live yet
            </h3>
            <div className="text-sm text-muted-foreground space-y-1">
              {!p?.paymentConfirmed && <p>• Complete subscription payment</p>}
              {p?.identityStatus !== "VERIFIED" && <p>• Identity verification pending</p>}
              {p?.insuranceStatus !== "VERIFIED" && !p?.optedOutOfInsurance && <p>• Insurance verification pending</p>}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Jobs", value: s?.totalJobs ?? 0, icon: Briefcase, testId: "stat-total-jobs" },
            { label: "Active Jobs", value: s?.activeJobs ?? 0, icon: Clock, testId: "stat-active-jobs" },
            { label: "Completed", value: s?.completedJobs ?? 0, icon: TrendingUp, testId: "stat-completed-jobs" },
            { label: "Response Rate", value: s?.responseRatePct != null ? `${s.responseRatePct}%` : "—", icon: Star, testId: "stat-response-rate" },
          ].map(({ label, value, icon: Icon, testId }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-5" data-testid={testId}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/jobs" data-testid="card-my-enquiries">
            <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">My Enquiries</h3>
              </div>
              <p className="text-sm text-muted-foreground">View and manage customer job requests</p>
            </div>
          </Link>

          <Link to="/tradie/settings" data-testid="card-profile-settings">
            <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Profile Settings</h3>
              </div>
              <p className="text-sm text-muted-foreground">Update your profile, portfolio, and availability</p>
            </div>
          </Link>

          <div className="bg-card border border-border rounded-xl p-6" data-testid="card-subscription">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Subscription</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Status: <span className={subscription?.status === "active" ? "text-green-400" : "text-yellow-400"} data-testid="text-sub-status">
                {subscription?.status ?? "—"}
              </span>
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground mb-3">
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-AU")}
              </p>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-6" data-testid="card-verification-status">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Verification Status</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between" data-testid="status-identity">
                <span className="text-muted-foreground">Identity</span>
                <Badge className={p?.identityStatus === "VERIFIED"
                  ? "bg-green-500/10 text-green-400 border-green-500/30 text-xs"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs"}>
                  {p?.identityStatus ?? "—"}
                </Badge>
              </div>
              <div className="flex justify-between" data-testid="status-insurance">
                <span className="text-muted-foreground">Insurance</span>
                <Badge className={p?.insuranceStatus === "VERIFIED" || p?.optedOutOfInsurance
                  ? "bg-green-500/10 text-green-400 border-green-500/30 text-xs"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs"}>
                  {p?.optedOutOfInsurance ? "Opted out" : (p?.insuranceStatus ?? "—")}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

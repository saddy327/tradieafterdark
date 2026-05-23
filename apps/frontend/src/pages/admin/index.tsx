import { useGetAdminDashboard, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Shield, Users, AlertTriangle, FileCheck, TrendingUp, DollarSign, Clock } from "lucide-react";

export default function AdminDashboardPage() {
  const { data, isLoading } = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), staleTime: 60_000 },
  });

  const d = data as any;

  return (
    <div className="min-h-screen bg-background text-foreground dark py-10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="heading-admin-dashboard">Admin Dashboard</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "MRR", value: isLoading ? "—" : `$${(d?.mrr ?? 0).toLocaleString()}`, icon: DollarSign, testId: "stat-mrr" },
            { label: "Active Tradies", value: isLoading ? "—" : d?.activeTradies, icon: Users, testId: "stat-active-tradies" },
            { label: "Pending Verifications", value: isLoading ? "—" : d?.pendingVerifications, icon: Clock, testId: "stat-pending-verifications" },
            { label: "Open Disputes", value: isLoading ? "—" : d?.openDisputes, icon: AlertTriangle, testId: "stat-open-disputes" },
          ].map(({ label, value, icon: Icon, testId }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-5" data-testid={testId}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value ?? "—"}</p>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { to: "/admin/verifications", icon: FileCheck, title: "Licence Verifications", desc: "Review and approve tradie licences" },
            { to: "/admin/identity", icon: Shield, title: "Identity Checks", desc: "Verify tradie identity documents" },
            { to: "/admin/tradies", icon: Users, title: "Tradie Management", desc: "Suspend, reinstate, search tradies" },
            { to: "/admin/disputes", icon: AlertTriangle, title: "Disputes", desc: "Resolve customer–tradie disputes" },
          ].map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={to} data-testid={`card-admin-${to.split("/").pop()}`}>
              <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

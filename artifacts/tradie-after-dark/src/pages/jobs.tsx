import { useListJobs, getListJobsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Clock, CheckCircle, XCircle, AlertTriangle, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Briefcase; color: string }> = {
  ENQUIRY: { label: "Enquiry", icon: Clock, color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  ACCEPTED: { label: "Accepted", icon: CheckCircle, color: "bg-green-500/10 text-green-400 border-green-500/30" },
  IN_PROGRESS: { label: "In Progress", icon: Briefcase, color: "bg-primary/10 text-primary border-primary/30" },
  COMPLETED: { label: "Completed", icon: CheckCircle, color: "bg-muted text-muted-foreground border-border" },
  CANCELLED: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/30" },
  DISPUTED: { label: "Disputed", icon: AlertTriangle, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
};

export default function JobsPage() {
  const { user } = useAuth();
  const { data: jobs, isLoading } = useListJobs(undefined, {
    query: { queryKey: getListJobsQueryKey(), staleTime: 30_000 },
  });

  return (
    <div className="min-h-screen bg-background text-foreground dark py-10">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-jobs">
          {user?.role === "TRADIE" ? "My Enquiries" : "My Jobs"}
        </h1>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-card animate-pulse" data-testid={`skeleton-job-${i}`} />
            ))}
          </div>
        ) : !(jobs as any[])?.length ? (
          <div className="text-center py-24 text-muted-foreground" data-testid="text-no-jobs">
            <Briefcase className="w-10 h-10 mx-auto mb-4 opacity-40" />
            <p className="text-lg">No jobs yet.</p>
            {user?.role === "CUSTOMER" && (
              <Button className="mt-4 bg-primary hover:bg-primary/90 text-white" asChild>
                <Link to="/search" data-testid="link-find-tradie">Find a tradie</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(jobs as any[]).map((job: any) => {
              const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.ENQUIRY;
              const StatusIcon = cfg.icon;
              return (
                <Link key={job.id} to={`/jobs/${job.id}`} data-testid={`card-job-${job.id}`}>
                  <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={`text-xs border ${cfg.color}`} data-testid={`badge-job-status-${job.id}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground" data-testid={`text-job-date-${job.id}`}>
                            {new Date(job.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground line-clamp-2" data-testid={`text-job-desc-${job.id}`}>
                          {job.description}
                        </p>
                        {job.tradie && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid={`text-job-tradie-${job.id}`}>
                            with {job.tradie.displayName}
                          </p>
                        )}
                      </div>
                      <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

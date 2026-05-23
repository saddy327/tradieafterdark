import { useParams, useLocation } from "wouter";
import { useGetTradieBySlug, useGetTradieReviews, getGetTradieBySlugQueryKey, getGetTradieReviewsQueryKey, useCreateJob } from "@workspace/api-client-react";
import { useState } from "react";
import { Star, Shield, Clock, Moon, Sun, MapPin, Banknote, Award, ChevronLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function TradieProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [postcode, setPostcode] = useState("");

  const { data: tradie, isLoading } = useGetTradieBySlug(slug, {
    query: { queryKey: getGetTradieBySlugQueryKey(slug), staleTime: 60_000 },
  });

  const { data: reviews } = useGetTradieReviews(slug, {
    query: { queryKey: getGetTradieReviewsQueryKey(slug) },
  });

  const createJob = useCreateJob();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tradie) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center text-muted-foreground" data-testid="text-tradie-not-found">
        Tradie not found.
      </div>
    );
  }

  const t = tradie as any;

  function handleEnquiry() {
    if (!user) {
      setLocation("/login");
      return;
    }
    if (user.role !== "CUSTOMER") {
      toast({ title: "Tradies can't send enquiries", variant: "destructive" });
      return;
    }
    setEnquiryOpen(true);
  }

  function submitEnquiry() {
    createJob.mutate(
      { data: { tradieId: t.id, description, postcode } as any },
      {
        onSuccess: (job: any) => {
          toast({ title: "Enquiry sent!", description: "You'll get a reply in your inbox." });
          setLocation(`/jobs/${job.id}`);
        },
        onError: (err: Error) => {
          toast({ title: "Failed to send enquiry", description: err.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark py-8">
      <div className="max-w-4xl mx-auto px-6">
        <button
          onClick={() => setLocation("/search")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          data-testid="button-back-search"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to search
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="w-32 h-32 rounded-2xl bg-muted overflow-hidden flex-shrink-0">
            {t.photo ? (
              <img src={t.photo} alt={t.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/30"
                style={{ fontFamily: "'Syne', sans-serif" }}>
                {t.displayName.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              {t.identityVerified && (
                <Badge className="bg-primary/10 text-primary border-primary/30" data-testid="badge-identity-verified">
                  <Shield className="w-3 h-3 mr-1" />Identity Verified
                </Badge>
              )}
              {t.insuranceVerified && (
                <Badge className="bg-green-500/10 text-green-400 border-green-500/30" data-testid="badge-insurance-verified">
                  Insured
                </Badge>
              )}
              {t.availableEvenings && (
                <Badge variant="outline" className="text-xs" data-testid="badge-evenings">
                  <Moon className="w-3 h-3 mr-1" />Evenings
                </Badge>
              )}
              {t.availableWeekends && (
                <Badge variant="outline" className="text-xs" data-testid="badge-weekends">
                  <Sun className="w-3 h-3 mr-1" />Weekends
                </Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold mb-1" data-testid="heading-tradie-name">{t.displayName}</h1>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1" data-testid="text-location">
                <MapPin className="w-3.5 h-3.5" />{t.homeSuburb}, {t.homeState}
              </span>
              <span className="flex items-center gap-1" data-testid="text-rate">
                <Banknote className="w-3.5 h-3.5" />${t.hourlyRate}/hr
              </span>
              {t.yearsExp && (
                <span className="flex items-center gap-1" data-testid="text-experience">
                  <Award className="w-3.5 h-3.5" />{t.yearsExp} yrs experience
                </span>
              )}
              {t.avgRating != null && (
                <span className="flex items-center gap-1" data-testid="text-rating">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  {t.avgRating.toFixed(1)} ({t.reviewCount} reviews)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {t.trades.map((trade: string) => (
                <Badge key={trade} variant="secondary" data-testid={`badge-trade-${trade}`}>{trade}</Badge>
              ))}
            </div>

            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={handleEnquiry}
              data-testid="button-send-enquiry"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Enquiry
            </Button>
          </div>
        </div>

        {/* Bio */}
        {t.bio && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6" data-testid="section-bio">
            <h2 className="font-semibold mb-3">About</h2>
            <p className="text-muted-foreground leading-relaxed">{t.bio}</p>
          </div>
        )}

        {/* Portfolio */}
        {t.portfolio?.length > 0 && (
          <div className="mb-6" data-testid="section-portfolio">
            <h2 className="font-semibold mb-3">Portfolio</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {t.portfolio.map((img: any) => (
                <div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-muted" data-testid={`portfolio-image-${img.id}`}>
                  <img src={img.url} alt={img.caption ?? "Portfolio"} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Licences */}
        {t.licences?.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6" data-testid="section-licences">
            <h2 className="font-semibold mb-4">Licences</h2>
            <div className="space-y-3">
              {t.licences.map((l: any) => (
                <div key={l.id} className="flex items-start justify-between" data-testid={`licence-${l.id}`}>
                  <div>
                    <p className="text-sm font-medium">{l.trade}</p>
                    <p className="text-xs text-muted-foreground">{l.issuingAuthority} · {l.issuingState}</p>
                  </div>
                  <Badge
                    className={l.verificationStatus === "VERIFIED"
                      ? "bg-green-500/10 text-green-400 border-green-500/30"
                      : l.verificationStatus === "SELF_DECLARED"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground"}
                  >
                    {l.verificationStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {(reviews as any[])?.length > 0 && (
          <div data-testid="section-reviews">
            <h2 className="font-semibold mb-4">Reviews ({(reviews as any[]).length})</h2>
            <div className="space-y-4">
              {(reviews as any[]).map((r: any) => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-5" data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(r.createdAt).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Enquiry drawer */}
      {enquiryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" data-testid="modal-enquiry">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Send an Enquiry to {t.displayName}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Describe your job</label>
                <Textarea
                  placeholder="What do you need done? When? Any specific requirements..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  data-testid="textarea-job-description"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Your postcode</label>
                <Input
                  placeholder="e.g. 4000"
                  value={postcode}
                  onChange={e => setPostcode(e.target.value)}
                  data-testid="input-enquiry-postcode"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setEnquiryOpen(false)}
                  className="flex-1"
                  data-testid="button-cancel-enquiry"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-white"
                  onClick={submitEnquiry}
                  disabled={!description.trim() || !postcode.trim() || createJob.isPending}
                  data-testid="button-submit-enquiry"
                >
                  {createJob.isPending ? "Sending…" : "Send Enquiry"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

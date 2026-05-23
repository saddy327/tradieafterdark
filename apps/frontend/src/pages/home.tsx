import { Link } from "wouter";
import { ArrowRight, Shield, Clock, Star, Zap, CheckCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListTradies } from "@workspace/api-client-react";
import TradieCard from "@/components/tradie-card";

export default function Home() {
  const { data, isLoading } = useListTradies({ limit: 4, page: 1 });

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted opacity-90" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 50%, hsl(25 100% 50%), transparent 60%), radial-gradient(circle at 80% 20%, hsl(25 100% 40%), transparent 50%)`,
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <Badge
            className="mb-6 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
            data-testid="badge-hero-tagline"
          >
            <Zap className="w-3 h-3 mr-1" />
            Australia&apos;s After-Hours Trade Marketplace
          </Badge>

          <h1
            className="text-5xl md:text-7xl font-extrabold leading-tight mb-6"
            style={{ fontFamily: "'Syne', sans-serif" }}
            data-testid="heading-hero"
          >
            Trade help,{" "}
            <span className="text-primary">after hours.</span>
          </h1>

          <p
            className="text-xl text-muted-foreground max-w-2xl mb-10"
            data-testid="text-hero-description"
          >
            Book verified tradies for evening and weekend jobs. No call-out fees
            hidden in fine print — just quality tradespeople when you need them.
          </p>

          <div className="flex flex-col sm:flex-row gap-4" data-testid="hero-cta-group">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white text-lg px-8 h-14 glow-orange"
              asChild
              data-testid="button-find-tradie"
            >
              <Link to="/search">
                Find a Tradie <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 h-14 border-border hover:border-primary/50"
              asChild
              data-testid="button-list-services"
            >
              <Link to="/signup?role=TRADIE">List Your Services</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-6 mt-10 text-sm text-muted-foreground" data-testid="hero-trust-signals">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              Identity verified
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              Licence checked
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              Insured tradies
            </span>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-card py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12" data-testid="heading-how-it-works">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Users, title: "Search tradies", desc: "Browse verified after-hours specialists in your postcode." },
              { icon: Clock, title: "Send an enquiry", desc: "Describe your job, preferred time, and hit send — it's free." },
              { icon: Star, title: "Get it done", desc: "Review your tradie once the job's complete and build trust." },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-start p-6 rounded-xl border border-border bg-background hover:border-primary/40 transition-colors"
                data-testid={`card-how-it-works-${i}`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-semibold text-primary mb-2">Step {i + 1}</span>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Tradies ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold" data-testid="heading-featured-tradies">
              Featured tradies
            </h2>
            <Link
              to="/search"
              className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1"
              data-testid="link-view-all-tradies"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 rounded-xl bg-card animate-pulse" data-testid={`skeleton-tradie-card-${i}`} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(data?.tradies ?? []).map((tradie) => (
                <TradieCard key={tradie.id} tradie={tradie} />
              ))}
              {!data?.tradies?.length && (
                <p className="text-muted-foreground col-span-4 text-center py-10" data-testid="text-no-tradies">
                  No tradies yet — be the first to list!
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-primary/5 border-t border-primary/20 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4" data-testid="heading-tradie-cta">
            Are you a tradie?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join TradieAfterDark and reach customers who need after-hours help.
            Build your profile, get verified, and grow your after-hours income.
          </p>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white px-10 h-12"
            asChild
            data-testid="button-join-as-tradie"
          >
            <Link to="/signup?role=TRADIE">Join as a Tradie</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

import { Link } from "wouter";
import { Star, Shield, Clock, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TradieCardProps {
  tradie: {
    id: string;
    slug: string;
    displayName: string;
    photo?: string | null;
    trades: string[];
    homeSuburb: string;
    homeState: string;
    hourlyRate: number;
    availableEvenings: boolean;
    availableWeekends: boolean;
    identityVerified: boolean;
    insuranceVerified: boolean;
    avgRating?: number | null;
    reviewCount: number;
  };
}

export default function TradieCard({ tradie }: TradieCardProps) {
  return (
    <Link
      to={`/tradie/${tradie.slug}`}
      data-testid={`card-tradie-${tradie.id}`}
      className="block group"
    >
      <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5">
        {/* Photo */}
        <div className="h-36 bg-muted relative overflow-hidden">
          {tradie.photo ? (
            <img
              src={tradie.photo}
              alt={tradie.displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/30"
              style={{ fontFamily: "'Syne', sans-serif" }}>
              {tradie.displayName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {tradie.identityVerified && (
              <Badge className="bg-primary/90 text-white text-xs px-1.5 py-0.5 border-0" data-testid={`badge-id-verified-${tradie.id}`}>
                <Shield className="w-3 h-3 mr-1" />ID
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="font-semibold text-foreground truncate" data-testid={`text-tradie-name-${tradie.id}`}>
            {tradie.displayName}
          </p>
          <p className="text-xs text-muted-foreground mb-2" data-testid={`text-tradie-location-${tradie.id}`}>
            {tradie.homeSuburb}, {tradie.homeState}
          </p>

          {/* Trades */}
          {tradie.trades.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tradie.trades.slice(0, 2).map(t => (
                <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0 border-0" data-testid={`badge-trade-${tradie.id}-${t}`}>
                  {t}
                </Badge>
              ))}
              {tradie.trades.length > 2 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 border-0">
                  +{tradie.trades.length - 2}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1" data-testid={`text-tradie-rate-${tradie.id}`}>
              <span className="font-semibold text-foreground">${tradie.hourlyRate}/hr</span>
            </span>

            <div className="flex items-center gap-2">
              {tradie.availableEvenings && (
                <Moon className="w-3.5 h-3.5 text-primary" title="Available evenings" />
              )}
              {tradie.avgRating != null && (
                <span className="flex items-center gap-0.5" data-testid={`text-tradie-rating-${tradie.id}`}>
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  {tradie.avgRating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

import { useState } from "react";
import { useListTradies, getListTradiesQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import TradieCard from "@/components/tradie-card";

const TRADES = [
  "Electrician", "Plumber", "Builder", "Carpenter", "Painter",
  "Tiler", "Roofer", "Landscaper", "Concreter", "Handyman",
  "Air Conditioning", "Locksmith", "Pest Control",
];

export default function SearchPage() {
  const [postcode, setPostcode] = useState("");
  const [trade, setTrade] = useState<string | undefined>();
  const [availability, setAvailability] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListTradies(
    { postcode: postcode || undefined, trade, availability, page, limit: 12 },
    {
      query: {
        queryKey: getListTradiesQueryKey({ postcode: postcode || undefined, trade, availability, page, limit: 12 }),
        staleTime: 60_000,
      },
    },
  );

  const totalPages = data ? Math.ceil(data.total / 12) : 1;

  return (
    <div className="min-h-screen bg-background text-foreground dark py-10">
      <div className="max-w-6xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-search">Find a Tradie</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 p-4 bg-card rounded-xl border border-border" data-testid="search-filters">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Postcode (e.g. 4000)"
              value={postcode}
              onChange={e => { setPostcode(e.target.value); setPage(1); }}
              data-testid="input-postcode"
            />
          </div>

          <Select value={trade ?? "all"} onValueChange={v => { setTrade(v === "all" ? undefined : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-52" data-testid="select-trade">
              <SelectValue placeholder="All trades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trades</SelectItem>
              {TRADES.map(t => (
                <SelectItem key={t} value={t} data-testid={`option-trade-${t}`}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={availability ?? "any"} onValueChange={v => { setAvailability(v === "any" ? undefined : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-availability">
              <SelectValue placeholder="Any availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any availability</SelectItem>
              <SelectItem value="evenings">Evenings</SelectItem>
              <SelectItem value="weekends">Weekends</SelectItem>
              <SelectItem value="both">Evenings + Weekends</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-card animate-pulse" data-testid={`skeleton-tradie-${i}`} />
            ))}
          </div>
        ) : !data?.tradies?.length ? (
          <div className="text-center py-24 text-muted-foreground" data-testid="text-no-results">
            <SlidersHorizontal className="w-10 h-10 mx-auto mb-4 opacity-40" />
            <p className="text-lg">No tradies found matching your filters.</p>
            <p className="text-sm mt-2">Try broadening your search.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-results-count">
              {data.total} tradie{data.total !== 1 ? "s" : ""} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.tradies.map(tradie => (
                <TradieCard key={tradie.id} tradie={tradie} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-10" data-testid="pagination">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

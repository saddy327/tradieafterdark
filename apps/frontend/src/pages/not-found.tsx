import { Link } from "wouter";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center">
      <div className="text-center">
        <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2" data-testid="heading-404">404</h1>
        <p className="text-muted-foreground mb-6">That page doesn&apos;t exist.</p>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white" data-testid="button-go-home">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}

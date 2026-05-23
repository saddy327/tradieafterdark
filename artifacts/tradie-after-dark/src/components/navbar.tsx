import { Link, useLocation } from "wouter";
import { Zap, Menu, X, LogOut, User, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [, location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border" data-testid="navbar">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" data-testid="link-logo">
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif" }}>
            TradieAfterDark
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 text-sm" data-testid="nav-desktop">
          <Link to="/search" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-search">
            Find Tradies
          </Link>
          {!user && (
            <Link to="/signup?role=TRADIE" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-list-services">
              List Services
            </Link>
          )}
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-3" data-testid="nav-auth">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                  <User className="w-4 h-4" />
                  <span className="max-w-32 truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user.role === "TRADIE" && (
                  <DropdownMenuItem asChild data-testid="menu-item-dashboard">
                    <Link to="/tradie/dashboard">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "ADMIN" && (
                  <DropdownMenuItem asChild data-testid="menu-item-admin">
                    <Link to="/admin">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "CUSTOMER" && (
                  <DropdownMenuItem asChild data-testid="menu-item-jobs">
                    <Link to="/jobs">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      My Jobs
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                  data-testid="menu-item-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild data-testid="button-nav-login">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" asChild data-testid="button-nav-signup">
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(o => !o)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-6 py-4 space-y-3" data-testid="nav-mobile">
          <Link to="/search" className="block text-sm text-muted-foreground hover:text-foreground" data-testid="mobile-link-search" onClick={() => setMobileOpen(false)}>
            Find Tradies
          </Link>
          {!user && (
            <>
              <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground" data-testid="mobile-link-login" onClick={() => setMobileOpen(false)}>
                Sign in
              </Link>
              <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-white" asChild>
                <Link to="/signup" onClick={() => setMobileOpen(false)} data-testid="mobile-link-signup">Get started</Link>
              </Button>
            </>
          )}
          {user && (
            <button onClick={logout} className="block text-sm text-destructive" data-testid="mobile-button-logout">
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

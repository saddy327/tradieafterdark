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
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (path: string) =>
    `relative text-[15px] lg:text-base font-bold tracking-[0.01em] transition-colors
    ${
      location === path
        ? "text-orange-400"
        : "text-zinc-100 hover:text-orange-400"
    }
    after:absolute after:left-0 after:-bottom-2 after:h-[2px] after:bg-orange-500 after:transition-all
    ${location === path ? "after:w-full" : "after:w-0 hover:after:w-full"}`;

  return (
    <nav
      className="sticky top-0 z-50 border-b border-orange-500/25 bg-[#101010]/95 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.45)]"
      data-testid="navbar"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 group"
          data-testid="link-logo"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/35 group-hover:bg-orange-500/25 transition-colors">
            <Zap className="w-5 h-5 text-orange-500 fill-orange-500" />
          </span>

          <span
            className="font-extrabold text-xl lg:text-2xl text-white tracking-[-0.03em] leading-none group-hover:text-orange-400 transition-colors"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Tradie<span className="text-orange-500">AfterDark</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div
          className="hidden md:flex items-center gap-9"
          data-testid="nav-desktop"
        >
          <Link
            to="/search"
            className={navLinkClass("/search")}
            data-testid="link-nav-search"
          >
            Find Tradies
          </Link>

          {!user && (
            <Link
              to="/signup?role=TRADIE"
              className="relative text-[15px] lg:text-base font-bold tracking-[0.01em] text-zinc-100 hover:text-orange-400 transition-colors after:absolute after:left-0 after:-bottom-2 after:h-[2px] after:w-0 after:bg-orange-500 after:transition-all hover:after:w-full"
              data-testid="link-nav-list-services"
            >
              List Services
            </Link>
          )}
        </div>

        {/* Desktop Auth */}
        <div
          className="hidden md:flex items-center gap-3"
          data-testid="nav-auth"
        >
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 gap-2 text-[14px] font-bold text-zinc-100 hover:text-orange-400 hover:bg-orange-500/10 border border-orange-500/25"
                  data-testid="button-user-menu"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-36 truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-52 bg-[#151515] border border-orange-500/25 text-zinc-100 shadow-xl"
              >
                {user.role === "TRADIE" && (
                  <DropdownMenuItem
                    asChild
                    className="text-[14px] font-semibold focus:bg-orange-500/10 focus:text-orange-400"
                    data-testid="menu-item-dashboard"
                  >
                    <Link to="/tradie/dashboard">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}

                {user.role === "ADMIN" && (
                  <DropdownMenuItem
                    asChild
                    className="text-[14px] font-semibold focus:bg-orange-500/10 focus:text-orange-400"
                    data-testid="menu-item-admin"
                  >
                    <Link to="/admin">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}

                {user.role === "CUSTOMER" && (
                  <DropdownMenuItem
                    asChild
                    className="text-[14px] font-semibold focus:bg-orange-500/10 focus:text-orange-400"
                    data-testid="menu-item-jobs"
                  >
                    <Link to="/jobs">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      My Jobs
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="bg-orange-500/20" />

                <DropdownMenuItem
                  onClick={logout}
                  className="text-[14px] font-semibold text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
                  data-testid="menu-item-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 text-[14px] lg:text-[15px] font-bold text-zinc-200 hover:text-orange-400 hover:bg-orange-500/10"
                asChild
                data-testid="button-nav-login"
              >
                <Link to="/login">Sign in</Link>
              </Button>

              <Button
                size="sm"
                className="h-10 px-5 text-[14px] lg:text-[15px] font-extrabold bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.35)]"
                asChild
                data-testid="button-nav-signup"
              >
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          data-testid="button-mobile-menu"
          aria-label="Toggle mobile menu"
        >
          {mobileOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t border-orange-500/25 bg-[#101010] px-6 py-5 space-y-4 shadow-xl"
          data-testid="nav-mobile"
        >
          <Link
            to="/search"
            className="block text-base font-bold text-zinc-100 hover:text-orange-400 transition-colors"
            data-testid="mobile-link-search"
            onClick={() => setMobileOpen(false)}
          >
            Find Tradies
          </Link>

          {!user && (
            <>
              <Link
                to="/signup?role=TRADIE"
                className="block text-base font-bold text-zinc-100 hover:text-orange-400 transition-colors"
                data-testid="mobile-link-list-services"
                onClick={() => setMobileOpen(false)}
              >
                List Services
              </Link>

              <Link
                to="/login"
                className="block text-base font-bold text-zinc-100 hover:text-orange-400 transition-colors"
                data-testid="mobile-link-login"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>

              <Button
                size="sm"
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white text-base font-extrabold shadow-[0_0_20px_rgba(249,115,22,0.35)]"
                asChild
              >
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  data-testid="mobile-link-signup"
                >
                  Get started
                </Link>
              </Button>
            </>
          )}

          {user && (
            <>
              {user.role === "TRADIE" && (
                <Link
                  to="/tradie/dashboard"
                  className="block text-base font-bold text-zinc-100 hover:text-orange-400 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </Link>
              )}

              {user.role === "ADMIN" && (
                <Link
                  to="/admin"
                  className="block text-base font-bold text-zinc-100 hover:text-orange-400 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Admin Panel
                </Link>
              )}

              {user.role === "CUSTOMER" && (
                <Link
                  to="/jobs"
                  className="block text-base font-bold text-zinc-100 hover:text-orange-400 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  My Jobs
                </Link>
              )}

              <button
                onClick={logout}
                className="block text-base font-bold text-red-400 hover:text-red-300 transition-colors"
                data-testid="mobile-button-logout"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
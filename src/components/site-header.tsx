import { Link, useLocation } from "@tanstack/react-router";
import { Crown, LogIn, Menu, ShoppingBag, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/language";
import { useBooking } from "@/lib/booking-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { lang, setLang, t } = useLang();
  const { cart } = useBooking();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/search", label: t("nav.search") },
    { to: "/dashboard", label: t("nav.dashboard") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-navy/95 backdrop-blur supports-[backdrop-filter]:bg-navy/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-navy-foreground">
          <Crown className="h-5 w-5 text-gold" />
          <span className="font-display text-lg font-semibold tracking-wide">
            Maison <span className="text-gold">Royale</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-gold"
                    : "text-navy-foreground/80 hover:text-navy-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-full border border-navy-foreground/15 p-0.5 sm:flex">
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                  lang === l
                    ? "bg-gold text-gold-foreground"
                    : "text-navy-foreground/70 hover:text-navy-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon" className="text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground">
              <ShoppingBag className="h-5 w-5" />
            </Button>
            {cart.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                {cart.length}
              </span>
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/dashboard">{t("nav.dashboard")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profile">{t("nav.profile")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  {t("nav.signin")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-navy-foreground/10 bg-navy md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-navy-foreground/80 hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 px-3">
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    lang === l
                      ? "bg-gold text-gold-foreground"
                      : "border border-navy-foreground/20 text-navy-foreground/70",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
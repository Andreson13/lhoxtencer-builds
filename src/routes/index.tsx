import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Award, Sparkles, Utensils } from "lucide-react";
import heroHotel from "@/assets/hero-hotel.jpg";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/language";
import { SearchPanel } from "@/components/search-panel";
import { rooms } from "@/lib/rooms";
import { RoomCard } from "@/components/room-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Royale — Réservez votre séjour d'exception" },
      {
        name: "description",
        content:
          "Découvrez nos suites raffinées, services de conciergerie et expériences exclusives. Réservez en quelques clics.",
      },
      { property: "og:title", content: "Maison Royale — Hôtellerie de luxe" },
      {
        property: "og:description",
        content: "Réservez votre suite d'exception à Maison Royale.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useLang();
  const featured = rooms.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroHotel}
            alt="Maison Royale exterior"
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/50 to-background" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-32 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pt-36">
          <div className="max-w-2xl text-navy-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-navy/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {t("hero.eyebrow")}
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base text-navy-foreground/85 sm:text-lg">
              {t("hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="luxe" size="xl">
                <Link to="/search">
                  {t("nav.search")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="border-navy-foreground/40 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground">
                <Link to="/dashboard">{t("nav.dashboard")}</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Floating search panel */}
        <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
          <SearchPanel variant="floating" />
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {lang === "fr" ? "Nos chambres" : "Our rooms"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-navy sm:text-4xl">
              {lang === "fr" ? "Sélection signature" : "Signature selection"}
            </h2>
          </div>
          <Link to="/search" className="hidden text-sm font-medium text-navy hover:text-gold sm:inline-flex sm:items-center sm:gap-1">
            {lang === "fr" ? "Tout voir" : "View all"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((r) => (
            <RoomCard key={r.id} room={r} />
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            { icon: Award, title: lang === "fr" ? "Service 5 étoiles" : "5-star service", desc: lang === "fr" ? "Conciergerie 24/7 et équipe attentionnée." : "24/7 concierge and attentive team." },
            { icon: Utensils, title: lang === "fr" ? "Gastronomie" : "Gastronomy", desc: lang === "fr" ? "Restaurant signature et room service raffiné." : "Signature restaurant and refined room service." },
            { icon: Sparkles, title: lang === "fr" ? "Spa & bien-être" : "Spa & wellness", desc: lang === "fr" ? "Soins exclusifs, hammam et piscine privée." : "Exclusive treatments, hammam and private pool." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-navy">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

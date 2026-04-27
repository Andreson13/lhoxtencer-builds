import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { SearchPanel } from "@/components/search-panel";
import { RoomCard } from "@/components/room-card";
import { useBooking } from "@/lib/booking-store";
import { rooms } from "@/lib/rooms";
import { useLang } from "@/lib/language";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Réserver une chambre — Maison Royale" },
      {
        name: "description",
        content: "Recherchez et réservez parmi nos chambres et suites disponibles.",
      },
      { property: "og:title", content: "Réserver une chambre — Maison Royale" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { search } = useBooking();
  const { t, lang } = useLang();

  const filtered = useMemo(() => {
    return rooms.filter(
      (r) =>
        r.capacity >= search.guests &&
        (search.roomType === "all" || r.type === search.roomType),
    );
  }, [search]);

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {lang === "fr" ? "Réservation" : "Booking"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-navy sm:text-4xl">
            {t("room.results")}
          </h1>
        </div>
        <SearchPanel />
        <div className="mt-8">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
              {t("room.empty")}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <RoomCard key={r.id} room={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
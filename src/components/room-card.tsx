import { useState } from "react";
import { ChevronLeft, ChevronRight, Users, Wifi, Snowflake, Tv, Lock, Coffee, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLang, formatPrice } from "@/lib/language";
import { useBooking } from "@/lib/booking-store";
import { roomTypeLabel, type Room } from "@/lib/rooms";
import { RoomDetailsDialog } from "@/components/room-details-dialog";
import { toast } from "sonner";

const amenityIcons: Record<string, typeof Wifi> = {
  wifi: Wifi,
  ac: Snowflake,
  tv: Tv,
  safe: Lock,
  breakfast: Coffee,
  minibar: Wine,
};

export function RoomCard({ room }: { room: Room }) {
  const { lang, t } = useLang();
  const { addRoom, cart } = useBooking();
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const inCart = cart.some((r) => r.id === room.id);

  const next = () => setIdx((i) => (i + 1) % room.images.length);
  const prev = () => setIdx((i) => (i - 1 + room.images.length) % room.images.length);

  return (
    <>
      <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-luxe">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={room.images[idx]}
            alt={room.name[lang]}
            loading="lazy"
            width={1280}
            height={960}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <Badge className="absolute left-3 top-3 bg-navy text-navy-foreground hover:bg-navy">
            {roomTypeLabel[room.type][lang]}
          </Badge>
          {room.images.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-navy/70 p-1.5 text-gold opacity-0 transition-opacity hover:bg-navy group-hover:opacity-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={next}
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-navy/70 p-1.5 text-gold opacity-0 transition-opacity hover:bg-navy group-hover:opacity-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {room.images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-all ${
                      i === idx ? "w-4 bg-gold" : "bg-white/70"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-navy">{room.name[lang]}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {room.capacity}
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {room.description[lang]}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {room.amenities
              .filter((a) => a.included)
              .slice(0, 5)
              .map((a) => {
                const Icon = amenityIcons[a.key] ?? Wifi;
                return (
                  <span
                    key={a.key}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                  >
                    <Icon className="h-3 w-3 text-gold" />
                    {a.label[lang]}
                  </span>
                );
              })}
          </div>

          <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
            <div>
              <div className="font-display text-2xl font-bold text-gold">
                {formatPrice(room.pricePerNight, lang)}
              </div>
              <div className="text-xs text-muted-foreground">{t("room.pernight")}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                {t("room.details")}
              </Button>
              <Button
                variant="luxe"
                size="sm"
                onClick={() => {
                  addRoom(room);
                  toast.success(`${room.name[lang]} ${lang === "fr" ? "ajoutée" : "added"}`);
                }}
                disabled={inCart}
              >
                {inCart ? "✓" : t("room.select")}
              </Button>
            </div>
          </div>
        </div>
      </article>

      <RoomDetailsDialog room={room} open={open} onOpenChange={setOpen} />
    </>
  );
}
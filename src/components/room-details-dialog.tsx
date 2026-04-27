import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang, formatPrice } from "@/lib/language";
import { useBooking } from "@/lib/booking-store";
import type { Room } from "@/lib/rooms";
import { toast } from "sonner";

export function RoomDetailsDialog({
  room,
  open,
  onOpenChange,
}: {
  room: Room;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { lang, t } = useLang();
  const { addRoom, cart } = useBooking();
  const [idx, setIdx] = useState(0);
  const inCart = cart.some((r) => r.id === room.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{room.name[lang]}</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-[16/10] bg-muted">
          <img
            src={room.images[idx]}
            alt={room.name[lang]}
            className="h-full w-full object-cover"
          />
          <button
            onClick={() => setIdx((i) => (i - 1 + room.images.length) % room.images.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-navy/80 p-2 text-gold hover:bg-navy"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % room.images.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-navy/80 p-2 text-gold hover:bg-navy"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold text-navy">{room.name[lang]}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> {room.capacity} {t("room.capacity")}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-gold">
                {formatPrice(room.pricePerNight, lang)}
              </div>
              <div className="text-xs text-muted-foreground">{t("room.pernight")}</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {room.description[lang]}
          </p>

          <h3 className="mt-6 font-display text-lg font-semibold text-navy">
            {lang === "fr" ? "Équipements" : "Amenities"}
          </h3>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {room.amenities.map((a) => (
              <li key={a.key} className="flex items-center gap-2 text-sm">
                {a.included ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={a.included ? "text-foreground" : "text-muted-foreground line-through"}>
                  {a.label[lang]}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
            <Button
              variant="luxe"
              onClick={() => {
                addRoom(room);
                toast.success(`${room.name[lang]} ${lang === "fr" ? "ajoutée" : "added"}`);
                onOpenChange(false);
              }}
              disabled={inCart}
            >
              {inCart ? (lang === "fr" ? "Déjà dans le panier" : "Already in cart") : t("room.select")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBooking } from "@/lib/booking-store";
import { useLang } from "@/lib/language";
import { cn } from "@/lib/utils";

export function SearchPanel({ variant = "inline" }: { variant?: "inline" | "floating" }) {
  const { t, lang } = useLang();
  const { search, setSearch } = useBooking();
  const navigate = useNavigate();

  const submit = () => {
    navigate({ to: "/search" });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-luxe sm:p-6",
        variant === "floating" && "backdrop-blur",
      )}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-gold" />
            {t("search.checkin")}
          </Label>
          <Input
            type="date"
            value={search.checkIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setSearch({ ...search, checkIn: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-gold" />
            {t("search.checkout")}
          </Label>
          <Input
            type="date"
            value={search.checkOut}
            min={search.checkIn}
            onChange={(e) => setSearch({ ...search, checkOut: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-gold" />
            {t("search.guests")}
          </Label>
          <Select
            value={String(search.guests)}
            onValueChange={(v) => setSearch({ ...search, guests: Number(v) })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }).map((_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {i + 1} {lang === "fr" ? (i === 0 ? "voyageur" : "voyageurs") : i === 0 ? "guest" : "guests"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("search.roomtype")}
          </Label>
          <Select
            value={search.roomType}
            onValueChange={(v) =>
              setSearch({ ...search, roomType: v as typeof search.roomType })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("search.all")}</SelectItem>
              <SelectItem value="standard">{lang === "fr" ? "Classique" : "Standard"}</SelectItem>
              <SelectItem value="deluxe">Deluxe</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
              <SelectItem value="presidential">{lang === "fr" ? "Présidentielle" : "Presidential"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="luxe" size="lg" onClick={submit} className="h-11 w-full md:w-auto">
            <Search className="h-4 w-4" />
            {t("search.cta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
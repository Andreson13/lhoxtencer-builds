import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Room } from "./rooms";

export type AddOns = {
  breakfast: boolean;
  earlyCheckin: "no" | "10am" | "12pm" | "2pm";
  lateCheckout: "no" | "2pm" | "4pm" | "6pm";
  parking: "no" | "standard" | "covered" | "vip";
  airportTransfer: boolean;
  spa: boolean;
};

export const ADDON_PRICES = {
  breakfast: 8000, // per night per room
  earlyCheckin: { no: 0, "10am": 25000, "12pm": 15000, "2pm": 8000 },
  lateCheckout: { no: 0, "2pm": 8000, "4pm": 15000, "6pm": 25000 },
  parking: { no: 0, standard: 5000, covered: 10000, vip: 18000 },
  airportTransfer: 22000,
  spa: 35000,
} as const;

export type SearchCriteria = {
  checkIn: string; // ISO yyyy-mm-dd
  checkOut: string;
  guests: number;
  roomType: "all" | "standard" | "deluxe" | "suite" | "presidential";
};

export type GuestInfo = {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  address?: string;
  nationality?: string;
};

export type Booking = {
  id: string;
  reference: string;
  rooms: Room[];
  checkIn: string;
  checkOut: string;
  guests: number;
  addOns: AddOns;
  specialRequests: string;
  guestInfo: GuestInfo;
  totals: { subtotal: number; addons: number; taxes: number; total: number };
  status: "confirmed" | "pending" | "checked-in" | "completed" | "cancelled";
  createdAt: string;
};

type Ctx = {
  search: SearchCriteria;
  setSearch: (s: SearchCriteria) => void;
  cart: Room[];
  addRoom: (r: Room) => void;
  removeRoom: (id: string) => void;
  clearCart: () => void;
  addOns: AddOns;
  setAddOns: (a: AddOns) => void;
  specialRequests: string;
  setSpecialRequests: (s: string) => void;
  guestInfo: GuestInfo;
  setGuestInfo: (g: GuestInfo) => void;
  bookings: Booking[];
  addBooking: (b: Booking) => void;
  cancelBooking: (id: string) => void;
  lastBooking: Booking | null;
  setLastBooking: (b: Booking | null) => void;
};

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const defaultAddOns: AddOns = {
  breakfast: false,
  earlyCheckin: "no",
  lateCheckout: "no",
  parking: "no",
  airportTransfer: false,
  spa: false,
};

const defaultGuestInfo: GuestInfo = {
  fullName: "Amélie Dupont",
  email: "amelie.dupont@example.com",
  phone: "70 12 34 56",
  countryCode: "+221",
  address: "",
  nationality: "Sénégal",
};

const seedBookings = (): Booking[] => [
  {
    id: "b-001",
    reference: "MR-7H29X",
    rooms: [],
    checkIn: todayPlus(14),
    checkOut: todayPlus(17),
    guests: 2,
    addOns: { ...defaultAddOns, breakfast: true },
    specialRequests: "Étage élevé, vue mer si possible.",
    guestInfo: defaultGuestInfo,
    totals: { subtotal: 285000, addons: 24000, taxes: 30900, total: 339900 },
    status: "confirmed",
    createdAt: todayPlus(-3),
  },
  {
    id: "b-002",
    reference: "MR-3K81P",
    rooms: [],
    checkIn: todayPlus(-30),
    checkOut: todayPlus(-26),
    guests: 2,
    addOns: defaultAddOns,
    specialRequests: "",
    guestInfo: defaultGuestInfo,
    totals: { subtotal: 260000, addons: 0, taxes: 26000, total: 286000 },
    status: "completed",
    createdAt: todayPlus(-45),
  },
];

const BookingContext = createContext<Ctx | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<SearchCriteria>({
    checkIn: todayPlus(7),
    checkOut: todayPlus(10),
    guests: 2,
    roomType: "all",
  });
  const [cart, setCart] = useState<Room[]>([]);
  const [addOns, setAddOns] = useState<AddOns>(defaultAddOns);
  const [specialRequests, setSpecialRequests] = useState("");
  const [guestInfo, setGuestInfo] = useState<GuestInfo>(defaultGuestInfo);
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);

  const value = useMemo<Ctx>(
    () => ({
      search,
      setSearch,
      cart,
      addRoom: (r) => setCart((prev) => (prev.find((x) => x.id === r.id) ? prev : [...prev, r])),
      removeRoom: (id) => setCart((prev) => prev.filter((r) => r.id !== id)),
      clearCart: () => setCart([]),
      addOns,
      setAddOns,
      specialRequests,
      setSpecialRequests,
      guestInfo,
      setGuestInfo,
      bookings,
      addBooking: (b) => setBookings((prev) => [b, ...prev]),
      cancelBooking: (id) =>
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
        ),
      lastBooking,
      setLastBooking,
    }),
    [search, cart, addOns, specialRequests, guestInfo, bookings, lastBooking],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

export function computeTotals(
  cart: Room[],
  addOns: AddOns,
  checkIn: string,
  checkOut: string,
) {
  const nights = nightsBetween(checkIn, checkOut) || 1;
  const subtotal = cart.reduce((sum, r) => sum + r.pricePerNight * nights, 0);
  const breakfast = addOns.breakfast ? ADDON_PRICES.breakfast * nights * cart.length : 0;
  const addons =
    breakfast +
    ADDON_PRICES.earlyCheckin[addOns.earlyCheckin] +
    ADDON_PRICES.lateCheckout[addOns.lateCheckout] +
    ADDON_PRICES.parking[addOns.parking] * nights +
    (addOns.airportTransfer ? ADDON_PRICES.airportTransfer : 0) +
    (addOns.spa ? ADDON_PRICES.spa : 0);
  const taxes = Math.round((subtotal + addons) * 0.1);
  return { subtotal, addons, taxes, total: subtotal + addons + taxes, nights };
}

export function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "MR-";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
import roomStandard from "@/assets/room-standard.jpg";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomSuite from "@/assets/room-suite.jpg";
import roomPresidential from "@/assets/room-presidential.jpg";
import roomBathroom from "@/assets/room-bathroom.jpg";

export type RoomType = "standard" | "deluxe" | "suite" | "presidential";

export type Amenity = {
  key: string;
  label: { fr: string; en: string };
  included: boolean;
};

export type Room = {
  id: string;
  type: RoomType;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  capacity: number;
  pricePerNight: number;
  images: string[];
  amenities: Amenity[];
};

const baseAmenities = (extras: Partial<Record<string, boolean>> = {}): Amenity[] => [
  { key: "wifi", label: { fr: "WiFi haut-débit", en: "High-speed WiFi" }, included: true },
  { key: "ac", label: { fr: "Climatisation", en: "Air conditioning" }, included: true },
  { key: "tv", label: { fr: "Smart TV 55\"", en: "Smart TV 55\"" }, included: true },
  { key: "minibar", label: { fr: "Minibar", en: "Minibar" }, included: extras.minibar ?? false },
  { key: "safe", label: { fr: "Coffre-fort", en: "In-room safe" }, included: true },
  { key: "breakfast", label: { fr: "Petit-déjeuner", en: "Breakfast" }, included: extras.breakfast ?? false },
];

export const rooms: Room[] = [
  {
    id: "rm-101",
    type: "standard",
    name: { fr: "Chambre Classique", en: "Classic Room" },
    description: {
      fr: "Une chambre élégante au confort impeccable, parfaite pour un séjour d'affaires ou en couple.",
      en: "An elegant room with impeccable comfort, perfect for a business trip or a couple's getaway.",
    },
    capacity: 2,
    pricePerNight: 65000,
    images: [roomStandard, roomBathroom, roomDeluxe],
    amenities: baseAmenities(),
  },
  {
    id: "rm-201",
    type: "deluxe",
    name: { fr: "Chambre Deluxe", en: "Deluxe Room" },
    description: {
      fr: "Volumes généreux, mobilier signé et vue panoramique sur la ville.",
      en: "Generous volumes, signature furnishings and panoramic city views.",
    },
    capacity: 3,
    pricePerNight: 95000,
    images: [roomDeluxe, roomBathroom, roomStandard],
    amenities: baseAmenities({ minibar: true }),
  },
  {
    id: "rm-301",
    type: "suite",
    name: { fr: "Suite Junior", en: "Junior Suite" },
    description: {
      fr: "Un salon séparé, une chambre lumineuse et une vue à couper le souffle.",
      en: "A separate living room, a bright bedroom and breathtaking views.",
    },
    capacity: 4,
    pricePerNight: 145000,
    images: [roomSuite, roomBathroom, roomDeluxe],
    amenities: baseAmenities({ minibar: true, breakfast: true }),
  },
  {
    id: "rm-302",
    type: "suite",
    name: { fr: "Suite Exécutive", en: "Executive Suite" },
    description: {
      fr: "Espace de travail dédié, salon raffiné et accès au lounge exécutif.",
      en: "Dedicated workspace, refined lounge and access to the executive club.",
    },
    capacity: 4,
    pricePerNight: 175000,
    images: [roomSuite, roomDeluxe, roomBathroom],
    amenities: baseAmenities({ minibar: true, breakfast: true }),
  },
  {
    id: "rm-901",
    type: "presidential",
    name: { fr: "Suite Présidentielle", en: "Presidential Suite" },
    description: {
      fr: "L'expérience ultime : marbre, lustres et service de majordome 24/7.",
      en: "The ultimate experience: marble, chandeliers and 24/7 butler service.",
    },
    capacity: 6,
    pricePerNight: 350000,
    images: [roomPresidential, roomSuite, roomBathroom],
    amenities: baseAmenities({ minibar: true, breakfast: true }),
  },
];

export const roomTypeLabel: Record<RoomType, { fr: string; en: string }> = {
  standard: { fr: "Classique", en: "Standard" },
  deluxe: { fr: "Deluxe", en: "Deluxe" },
  suite: { fr: "Suite", en: "Suite" },
  presidential: { fr: "Présidentielle", en: "Presidential" },
};
import type { BoardSlot } from "./board";

export const GARMENT_CATEGORIES = [
  "outerwear",
  "tops",
  "bottoms",
  "dresses",
  "footwear",
  "accessories",
  "bags",
] as const;

export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

export const EXTRA_KINDS = [
  "skincare",
  "fragrance",
  "grooming",
  "other",
] as const;

export type ExtraKind = (typeof EXTRA_KINDS)[number];

export const FORMALITIES = [
  "casual",
  "smart-casual",
  "business",
  "formal",
  "athletic",
] as const;

export type Formality = (typeof FORMALITIES)[number];

export const FORMALITY_RANK: Record<Formality, number> = {
  athletic: 0,
  casual: 1,
  "smart-casual": 2,
  business: 3,
  formal: 4,
};

export const CLIMATES = [
  "hot",
  "warm",
  "mild",
  "cool",
  "cold",
  "rain",
  "snow",
] as const;

export type Climate = (typeof CLIMATES)[number];

export const SEASONS = ["spring", "summer", "fall", "winter", "all"] as const;
export type Season = (typeof SEASONS)[number];

export const FRAGRANCE_FAMILIES = [
  "citrus",
  "fresh",
  "woody",
  "amber",
  "floral",
  "leather",
] as const;

export type FragranceFamily = (typeof FRAGRANCE_FAMILIES)[number];

export const SKINCARE_SLOTS = ["am", "pm", "both"] as const;
export type SkincareSlot = (typeof SKINCARE_SLOTS)[number];

export const LOOK_SOURCES = ["manual", "engine", "stylist"] as const;
export type LookSource = (typeof LOOK_SOURCES)[number];

export const SUGGESTED_TAGS = [
  "School",
  "Work",
  "Weekend",
  "Travel",
  "Wedding",
  "Black tie",
  "Gym",
  "Layering",
] as const;

export type ThemeName = "dark" | "light";
export type LookLayout = "grid" | "stacked" | "layered";

export type Garment = {
  id: string;
  name: string;
  brand: string;
  category: GarmentCategory;
  colorName: string;
  hex: string;
  material: string;
  formality: Formality;
  seasons: Season[];
  climate: Climate[];
  notes: string;
  tags: string[];
  colorFamily?: string;
  imageSrc?: string;
  imageDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
  displayScale?: number;
  displayX?: number;
  displayY?: number;
  createdAt: number;
};

export type Extra = {
  id: string;
  name: string;
  brand: string;
  kind: ExtraKind;
  notes: string;
  climate: Climate[];
  formality: Formality[];
  tags: string[];
  family?: FragranceFamily;
  slot?: SkincareSlot;
  step?: number;
  imageSrc?: string;
  imageDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
  createdAt: number;
};

export type Look = {
  id: string;
  name: string;
  garmentIds: string[];
  extraIds: string[];
  occasion: string;
  notes: string;
  source: LookSource;
  plannedDate?: string;
  photoDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
  createdAt: number;
};

export type WornEntry = {
  date: string;
  garmentIds: string[];
};

export type PiecePose = {
  x: number;
  y: number;
  scale: number;
};

export type LookVote = {
  garmentIdsSorted: string;
  occasion: string;
  climate: Climate;
  whyKey: string;
  vote: 1 | -1;
  at: number;
  gen?: number;
  closetSig?: string;
};

export type LookVoteMap = Record<string, LookVote | 1 | -1>;

export type Profile = {
  styleNotes: string;
  defaultClimate: Climate;
  theme: ThemeName;
  lookLayout: LookLayout;
  layoutRev?: number;
  wornLog: WornEntry[];
  lookVotes?: LookVoteMap;
  lookRegen?: number;
  pieceLayout?: Record<string, Record<string, PiecePose>>;
  pieceHidden?: Record<string, string[]>;
  piecePlaced?: Record<string, string[]>;
  torsoPick?: Record<string, "outer" | "top">;
  boardSlots?: BoardSlot[];
  boardRev?: number;
  skipDemo?: boolean;
};

export type Brief = {
  description: string;
  climate: Climate;
  occasion: Formality;
  season: Season;
};

export type SuggestedLook = {
  name: string;
  garmentIds: string[];
  extraIds: string[];
  score: number;
  rationale: string;
  climateNotes: string;
  incomplete: string[];
  source: LookSource;
};

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  outerwear: "Outerwear",
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  footwear: "Footwear",
  accessories: "Accessories",
  bags: "Bags",
};

export const EXTRA_LABELS: Record<ExtraKind, string> = {
  skincare: "Skincare",
  fragrance: "Fragrance",
  grooming: "Grooming",
  other: "Other",
};

export const FORMALITY_LABELS: Record<Formality, string> = {
  casual: "Casual",
  "smart-casual": "Smart casual",
  business: "Business",
  formal: "Formal",
  athletic: "Athletic",
};

export const CLIMATE_LABELS: Record<Climate, string> = {
  hot: "Hot",
  warm: "Warm",
  mild: "Mild",
  cool: "Cool",
  cold: "Cold",
  rain: "Rain",
  snow: "Snow",
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  all: "All year",
};

export const FAMILY_LABELS: Record<FragranceFamily, string> = {
  citrus: "Citrus",
  fresh: "Fresh",
  woody: "Woody",
  amber: "Amber",
  floral: "Floral",
  leather: "Leather",
};

export const SLOT_LABELS: Record<SkincareSlot, string> = {
  am: "Morning",
  pm: "Evening",
  both: "Both",
};

export const SOURCE_LABELS: Record<LookSource, string> = {
  manual: "Saved",
  engine: "Composed",
  stylist: "Stylist",
};

export const SMART_FILTERS = [
  { id: "all", label: "All", test: () => true },
  {
    id: "school",
    label: "School",
    test: (g: Garment) => g.tags.includes("School"),
  },
  {
    id: "work",
    label: "Work",
    test: (g: Garment) =>
      g.tags.includes("Work") ||
      g.formality === "business" ||
      g.formality === "formal",
  },
  {
    id: "weekend",
    label: "Weekend",
    test: (g: Garment) =>
      g.tags.includes("Weekend") ||
      g.formality === "casual" ||
      g.formality === "smart-casual",
  },
  {
    id: "gym",
    label: "Gym",
    test: (g: Garment) =>
      g.tags.includes("Gym") || g.formality === "athletic",
  },
  {
    id: "rain",
    label: "Rain",
    test: (g: Garment) => g.climate.includes("rain"),
  },
] as const;

export type SmartFilterId = (typeof SMART_FILTERS)[number]["id"];

import { SAMPLE_IMAGES } from "./media";

export const BOARD_SLOT_IDS = [
  "hat",
  "tops",
  "outerwear",
  "dresses",
  "bottoms",
  "footwear",
  "accessory",
  "bag",
] as const;

export type BoardSlotId = (typeof BOARD_SLOT_IDS)[number];

export type BoardSlot = {
  id: BoardSlotId;
  label: string;
  cx: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

const LEGACY: Record<string, BoardSlotId> = {
  torso: "tops",
  bottom: "bottoms",
  feet: "footwear",
};

export const CANVAS_ASPECT = 4 / 5;
export const BOARD_REV = 5;

/** Typical image width/height for each slot. */
export const SLOT_ASPECT: Record<BoardSlotId, number> = {
  hat: 1.144,
  tops: 0.827,
  outerwear: 0.516,
  dresses: 0.55,
  bottoms: 0.343,
  footwear: 1.65,
  accessory: 0.54,
  bag: 1.177,
};

export const SAMPLE_ASPECTS: Record<string, number> = {
  g_navy_knit: 0.827,
  g_grey_tee: 0.843,
  g_white_oxford: 0.736,
  g_ivory_linen: 0.755,
  g_black_merino: 0.82,
  g_navy_coat: 0.516,
  g_camel_coat: 0.528,
  g_stone_jacket: 0.773,
  g_indigo_jean: 0.343,
  g_charcoal_trouser: 0.336,
  g_olive_chino: 0.362,
  g_sand_short: 0.922,
  g_white_sneaker: 1.644,
  g_black_oxford: 1.771,
  g_brown_chelsea: 1.359,
  g_suede_loafer: 1.816,
  g_steel_watch: 0.54,
  g_navy_tie: 0.191,
  g_brown_belt: 1.677,
  g_canvas_weekender: 1.177,
  g_black_tote: 0.691,
  g_navy_cap: 1.144,
  g_crew_pack: 0.741,
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function box(
  id: BoardSlotId,
  label: string,
  cx: number,
  y: number,
  h: number,
  aspect: number,
  visible = true,
): BoardSlot {
  return {
    id,
    label,
    cx,
    y,
    w: round1((h * aspect) / CANVAS_ASPECT),
    h,
    visible,
  };
}

export const DEFAULT_BOARD: BoardSlot[] = [
  box("hat", "Hat", 50, 1, 10, SLOT_ASPECT.hat),
  box("tops", "Top", 50, 3, 40, SLOT_ASPECT.tops),
  box("outerwear", "Jacket / coat", 50, 5, 66, SLOT_ASPECT.outerwear),
  box("dresses", "Dress", 50, 2, 80, SLOT_ASPECT.dresses),
  box("bottoms", "Bottoms", 50, 28, 58, SLOT_ASPECT.bottoms),
  box("footwear", "Shoes", 50, 85, 14, SLOT_ASPECT.footwear),
  box("accessory", "Accessory", 74, 30, 16, SLOT_ASPECT.accessory),
  box("bag", "Bag", 26, 50, 22, SLOT_ASPECT.bag),
];

export const BOARD_SAMPLES: Partial<Record<BoardSlotId, string>> = {
  hat: SAMPLE_IMAGES.g_navy_cap,
  tops: SAMPLE_IMAGES.g_navy_knit,
  outerwear: SAMPLE_IMAGES.g_navy_coat,
  dresses: SAMPLE_IMAGES.g_ivory_linen,
  bottoms: SAMPLE_IMAGES.g_indigo_jean,
  footwear: SAMPLE_IMAGES.g_white_sneaker,
  accessory: SAMPLE_IMAGES.g_steel_watch,
  bag: SAMPLE_IMAGES.g_crew_pack,
};

export const BOARD_Z: Record<BoardSlotId, number> = {
  bottoms: 2,
  tops: 3,
  dresses: 4,
  outerwear: 5,
  footwear: 6,
  hat: 7,
  accessory: 7,
  bag: 7,
};

export function fitSlot(slot: BoardSlot, aspect: number): BoardSlot {
  const a = aspect > 0.05 ? aspect : SLOT_ASPECT[slot.id];
  const slotVis = (slot.w / Math.max(slot.h, 1)) * CANVAS_ASPECT;
  let w = slot.w;
  let h = slot.h;
  if (a >= slotVis) {
    w = slot.w;
    h = (slot.w * CANVAS_ASPECT) / a;
  } else {
    h = slot.h;
    w = (slot.h * a) / CANVAS_ASPECT;
  }
  return { ...slot, w: round1(w), h: round1(h) };
}

export function garmentAspect(
  item: { id: string; name?: string; category?: string },
  slotId: BoardSlotId,
) {
  if (SAMPLE_ASPECTS[item.id]) return SAMPLE_ASPECTS[item.id];
  if (slotId === "bottoms" && /short/i.test(item.name ?? "")) return 0.92;
  return SLOT_ASPECT[slotId];
}

export function mergeBoard(saved?: BoardSlot[] | null): BoardSlot[] {
  const byId = new Map<string, BoardSlot>();
  for (const s of saved ?? []) {
    const id = LEGACY[s.id] ?? s.id;
    if (!BOARD_SLOT_IDS.includes(id as BoardSlotId)) continue;
    if (!byId.has(id)) byId.set(id, { ...s, id: id as BoardSlotId });
  }
  return DEFAULT_BOARD.map((base) => {
    const hit = byId.get(base.id);
    if (!hit) return { ...base };
    return {
      id: base.id,
      label: hit.label?.trim() || base.label,
      cx: num(hit.cx, base.cx, 4, 96),
      y: num(hit.y, base.y, 0, 96),
      w: num(hit.w, base.w, 6, 96),
      h: num(hit.h, base.h, 6, 96),
      visible: hit.visible !== false,
    };
  });
}

function num(n: unknown, fallback: number, min: number, max: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

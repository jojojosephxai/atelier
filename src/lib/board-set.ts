import type { Climate, Garment, GarmentCategory } from "./types";
import { FORMALITIES } from "./types";
import type { RoutineId } from "./routines";
import { richWhy } from "./rich-why.ts";

const ORDER: GarmentCategory[] = [
  "outerwear",
  "tops",
  "dresses",
  "bottoms",
  "footwear",
  "bags",
  "accessories",
];

const NEAR: Record<Climate, Climate[]> = {
  hot: ["hot", "warm"],
  warm: ["hot", "warm", "mild"],
  mild: ["warm", "mild", "cool"],
  cool: ["mild", "cool", "cold"],
  cold: ["cool", "cold", "snow"],
  rain: ["rain", "cool", "mild"],
  snow: ["cold", "snow", "cool"],
};

export function isGymLayer(g: Garment): boolean {
  return /hoodie|quarter[-\s]?zip/i.test(`${g.name} ${g.notes}`);
}

export function isCampusJacket(g: Garment): boolean {
  return /harrington|rain shell|denim jacket|field jacket/i.test(
    `${g.name} ${g.notes}`,
  );
}

function tagged(g: Garment, label: string): boolean {
  return (g.tags ?? []).some((t) => t.toLowerCase() === label.toLowerCase());
}

function climateOk(g: Garment, climate: Climate): boolean {
  return g.climate.some((c) => NEAR[climate].includes(c));
}

function occasionOk(g: Garment, routine: RoutineId): boolean {
  if (routine === "gym") {
    if (isCampusJacket(g)) return false;
    if (g.category === "outerwear" && !isGymLayer(g)) return false;
    if (/umbrella/i.test(g.name) || g.category === "accessories") return false;
    if (isGymLayer(g)) return true;
    return tagged(g, "Gym") || g.formality === "athletic";
  }
  if (isGymLayer(g)) return false;
  if (routine === "school") return tagged(g, "School");
  if (routine === "weekend") return tagged(g, "Weekend");
  return tagged(g, "Weekend") || g.formality === "smart-casual" || g.formality === "business";
}

function weatherLayerOk(g: Garment, routine: RoutineId, climate: Climate): boolean {
  const layer = g.category === "outerwear" || isGymLayer(g);
  if (!layer) return climateOk(g, climate);
  if (["hot", "warm"].includes(climate)) return false;
  if (routine === "gym") {
    return isGymLayer(g) && ["cool", "cold", "snow", "rain"].includes(climate);
  }
  if (climate === "rain") return /rain shell/i.test(g.name);
  if (climate === "cold" || climate === "snow") {
    return /field jacket|harrington/i.test(g.name);
  }
  if (climate === "cool") return /harrington|denim jacket/i.test(g.name);
  return /denim jacket|rain shell|harrington/i.test(g.name);
}

export function lookEligible(g: Garment): boolean {
  const color = (g.colorFamily || g.colorName || "").trim();
  return Boolean(
    g.category &&
      g.formality &&
      (FORMALITIES as readonly string[]).includes(g.formality) &&
      g.climate?.length &&
      color,
  );
}

/** All matching pieces for the Today board. Occasion + weather swap the set. */
export function todaySet(
  garments: Garment[],
  routine: RoutineId,
  climate: Climate,
): Garment[] {
  return garments
    .filter(
      (g) =>
        lookEligible(g) &&
        occasionOk(g, routine) &&
        weatherLayerOk(g, routine, climate),
    )
    .sort((a, b) => {
      const d = ORDER.indexOf(a.category) - ORDER.indexOf(b.category);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
}

export function needsLayer(climate: Climate): boolean {
  return !["hot", "warm"].includes(climate);
}

function gymWantsLayer(climate: Climate): boolean {
  return ["cool", "cold", "snow", "rain"].includes(climate);
}

export function wantsGymLayer(climate: Climate): boolean {
  return gymWantsLayer(climate);
}

/** School kits: burn each outer so cards are denim / rain / harrington. */
export function schoolOuterLooks(
  closet: Garment[],
  climate: Climate,
): Garment[][] {
  const pool = todaySet(closet, "school", climate);
  const burned = new Set<string>();
  const outers: Garment[] = [];
  for (const re of [/denim jacket/i, /rain shell/i, /harrington/i]) {
    const g = pool.find((x) => re.test(x.name) && !burned.has(x.id));
    if (g) {
      burned.add(g.id);
      outers.push(g);
    }
  }
  for (const g of pool) {
    if (outers.length >= 3) break;
    if (g.category !== "outerwear" || burned.has(g.id)) continue;
    burned.add(g.id);
    outers.push(g);
  }
  const tees = pool.filter(
    (g) => g.category === "tops" && !isGymLayer(g),
  );
  const merino = closet.find((g) => /merino/i.test(g.name) && g.category === "tops");
  if (merino && !tees.some((t) => t.id === merino.id)) {
    tees.unshift(merino);
  } else if (merino) {
    tees.sort((a, b) => Number(/merino/i.test(b.name)) - Number(/merino/i.test(a.name)));
  }
  const bottoms = pool.filter((g) => g.category === "bottoms");
  const shoes = pool.filter((g) => g.category === "footwear");
  const bags = pool.filter((g) => g.category === "bags");
  if (!tees.length || !bottoms.length || !shoes.length) {
    return [];
  }
  return [0, 1, 2].map((i) => {
    const outer = outers[i];
    const kit = [
      outer,
      tees[i % tees.length],
      bottoms[i % bottoms.length],
      shoes[i % shoes.length],
    ].filter((g): g is Garment => Boolean(g));
    if (bags.length) kit.push(bags[i % bags.length]);
    return kit;
  }).filter((kit) => kit.some((g) => g.category === "tops") && kit.some((g) => g.category === "bottoms"));
}
/** Weekend / going-out: unique outers, always three kits when a top+bottom+shoe exist. */
export function boardLooks(
  closet: Garment[],
  routine: RoutineId,
  climate: Climate,
): Garment[][] {
  if (routine === "gym") return gymLayerLooks(closet, climate);
  if (routine === "school") return schoolOuterLooks(closet, climate);
  const pool = todaySet(closet, routine, climate);
  const burned = new Set<string>();
  const outers: Garment[] = [];
  for (const g of pool) {
    if (g.category !== "outerwear" || burned.has(g.id)) continue;
    burned.add(g.id);
    outers.push(g);
  }
  const tees = pool.filter((g) => g.category === "tops" && !isGymLayer(g));
  const bottoms = pool.filter((g) => g.category === "bottoms");
  const shoes = pool.filter((g) => g.category === "footwear");
  const bags = pool.filter((g) => g.category === "bags");
  if (!tees.length || !bottoms.length || !shoes.length) return [];
  return [0, 1, 2].map((i) => {
    const kit = [
      outers[i],
      tees[i % tees.length],
      bottoms[i % bottoms.length],
      shoes[i % shoes.length],
    ].filter((g): g is Garment => Boolean(g));
    if (bags.length) kit.push(bags[i % bags.length]);
    return kit;
  });
}

export function gymLayerLooks(
  closet: Garment[],
  climate: Climate,
): Garment[][] {
  const pool = todaySet(closet, "gym", climate);
  const layers = pool.filter((g) => isGymLayer(g) && !isCampusJacket(g));
  const tees = pool.filter(
    (g) => g.category === "tops" && !isGymLayer(g) && !isCampusJacket(g),
  );
  const bottoms = pool.filter(
    (g) => g.category === "bottoms" && !isCampusJacket(g),
  );
  const shoes = pool.filter((g) => g.category === "footwear");
  if (!tees.length || !bottoms.length || !shoes.length) return [];
  return [0, 1, 2].map((i) => {
    const layer = layers.length ? layers[i % layers.length] : undefined;
    const tee = tees[i % tees.length];
    const bottom = bottoms[i % bottoms.length];
    const shoe = shoes[i % shoes.length];
    return [layer, tee, bottom, shoe].filter((g): g is Garment => Boolean(g));
  });
}

export function lookFitsClimate(
  pieces: Garment[],
  routine: RoutineId,
  climate: Climate,
): boolean {
  if (!pieces.length) return false;
  if (pieces.some((g) => /\bshorts?\b/i.test(g.name)) &&
      ["cool", "cold", "snow"].includes(climate)) {
    return false;
  }
  const layer = pieces.find(
    (g) => g.category === "outerwear" || isGymLayer(g),
  );
  if (routine === "gym") {
    if (pieces.some(isCampusJacket)) return false;
    if (!gymWantsLayer(climate) && pieces.some(isGymLayer)) return false;
    return true;
  }
  if (!needsLayer(climate) && layer) return false;
  if (climate === "rain" && layer && !/rain/i.test(layer.name)) return false;
  return true;
}

/** Swap the layer to match weather. Occasion stays; climate replaces the jacket. */
export function climateKit(
  pieces: Garment[],
  garments: Garment[],
  routine: RoutineId,
  climate: Climate,
): Garment[] {
  const pool = todaySet(garments, routine, climate);
  const keep = pieces.filter((g) => {
    if (g.category === "outerwear" || isGymLayer(g)) return false;
    if (routine === "gym" && isCampusJacket(g)) return false;
    if (routine === "gym" && /umbrella/i.test(g.name)) return false;
    if (/\bshorts?\b/i.test(g.name) && ["cool", "cold", "snow"].includes(climate)) {
      return false;
    }
    return climateOk(g, climate) || g.category === "footwear" || g.category === "bags";
  });
  const top = keep.find((g) => g.category === "tops") ??
    pool.find((g) => g.category === "tops" && !isGymLayer(g));
  const bottom =
    keep.find((g) => g.category === "bottoms") ??
    pool.find((g) => g.category === "bottoms");
  const shoes =
    keep.find((g) => g.category === "footwear") ??
    pool.find((g) => g.category === "footwear");
  let outer = pieces.find(
    (g) => g.category === "outerwear" || isGymLayer(g),
  );
  if (
    !outer &&
    (routine === "gym" ? gymWantsLayer(climate) : needsLayer(climate))
  ) {
    outer = pool.find((g) => g.category === "outerwear" || isGymLayer(g));
  }
  const bag =
    routine === "gym"
      ? undefined
      : (keep.find((g) => g.category === "bags") ??
        pool.find((g) => g.category === "bags"));
  const kit = [outer, top, bottom, shoes, bag].filter(
    (g): g is Garment => Boolean(g),
  );
  const seen = new Set<string>();
  return kit.filter((g) => !seen.has(g.id) && (seen.add(g.id), true));
}

function shortName(g: Garment): string {
  const n = g.name;
  if (/harrington/i.test(n)) return "Harrington";
  if (/field jacket/i.test(n)) return "Field jacket";
  if (/denim jacket/i.test(n)) return "Denim jacket";
  if (/rain shell/i.test(n)) return "Rain shell";
  if (/quarter-zip/i.test(n)) return "Quarter-zip";
  if (/hoodie/i.test(n)) return "Hoodie";
  if (/dinner jacket|tuxedo/i.test(n)) return "Dinner jacket";
  if (/blazer/i.test(n)) return `${g.colorName} blazer`;
  if (/overcoat|polo coat/i.test(n)) return `${g.colorName} coat`;
  const words = n.replace(/\b(the)\b/gi, "").trim().split(/\s+/);
  return words.length > 3 ? words.slice(-2).join(" ") : n;
}

/** Distinct title from the actual pieces — never "Black Black ceremony". */
export function lookName(pieces: Garment[], routine: RoutineId): string {
  const layer = pieces.find(isGymLayer);
  const outer = pieces.find((g) => g.category === "outerwear");
  const top = pieces.find((g) => g.category === "tops" && !isGymLayer(g));
  const bottom = pieces.find((g) => g.category === "bottoms");
  if (routine === "gym") {
    if (layer && top) return `${shortName(layer)} over ${shortName(top)}`;
    if (top && bottom) return `${shortName(top)} + ${shortName(bottom)}`;
  }
  if (outer && top) return `${shortName(outer)} + ${shortName(top)}`;
  if (top && bottom) return `${shortName(top)} + ${shortName(bottom)}`;
  return top?.name || outer?.name || pieces[0]?.name || "Look";
}

/** Today card title from the board pieces and day. Never an AI caption. */
export function boardY(pieces: Garment[], day: RoutineId): string {
  return lookName(pieces, day);
}

export function boardWhy(
  pieces: Garment[],
  routine: RoutineId,
  climate: Climate,
): string {
  return richWhy(pieces, routine, climate);
}

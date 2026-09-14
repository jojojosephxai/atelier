import { isCampusJacket, isGymLayer } from "./board-set";
import {
  insightForIndex,
  richWhy,
  whyOpeningFingerprint,
  type WhyInsight,
  WHY_INSIGHTS,
} from "./rich-why.ts";
import type { RoutineId } from "./routines";
import type { Climate, Garment } from "./types";
import { isNeutralHex } from "./utils";

/** Primary keys for voting / suppression — still one distinct key per look. */
export type WhyKey =
  | "occasion_formality"
  | "climate_layer"
  | "garment_role"
  | "color_or_texture_contrast"
  | "color"
  | "footwear"
  | "cloth";

const SLOTS: WhyKey[] = [
  "occasion_formality",
  "climate_layer",
  "color_or_texture_contrast",
];

/** Map legacy why keys → visual insight angles for copy. */
function insightFromKey(key: WhyKey, i = 0): WhyInsight {
  if (key === "color_or_texture_contrast" || key === "color" || key === "cloth") {
    return "texture";
  }
  if (key === "climate_layer") return "accent";
  if (key === "garment_role") return "silhouette";
  if (key === "occasion_formality") return "tonal";
  if (key === "footwear") return "accent";
  return insightForIndex(i);
}

type Candidate = { key: WhyKey; line: string; score: number };

const BANNED =
  /\b(comfortable|casual|good for school|calm and composed|wet-weather|mild day|value contrast|texture break|loud break|frames a softer|as the ground)\b|AC[-\s]?shell/i;

function topOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "tops" && !isGymLayer(g));
}
function bottomOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "bottoms");
}
function outerOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "outerwear" && !isGymLayer(g));
}
function layerOf(pieces: Garment[]) {
  return pieces.find(isGymLayer);
}

function clean(line: string): string {
  const t = line.trim();
  if (!t || BANNED.test(t)) return "";
  if (/umbrella|calls for/i.test(t)) return "";
  if (/against .+ is the contrast\.?$/i.test(t)) return "";
  if ((t.match(/,/g) ?? []).length >= 2) return "";
  if ((t.match(/ · /g) ?? []).length >= 2) return "";
  return t;
}

function hangTogether(a: Garment, b: Garment): string | null {
  const ma = (a.material || "").trim();
  const mb = (b.material || "").trim();
  const mal = ma.toLowerCase();
  const mbl = mb.toLowerCase();
  const tex =
    Boolean(mal && mbl) &&
    mal !== mbl &&
    !mal.includes(mbl) &&
    !mbl.includes(mal);
  if (tex) {
    return `${ma} outside and ${mb.toLowerCase()} inside keep the stack layered.`;
  }
  if (isNeutralHex(a.hex) && isNeutralHex(b.hex)) {
    return `${a.colorName} and ${b.colorName.toLowerCase()} stay quiet together.`;
  }
  if (
    ma &&
    mb &&
    /wool|merino|knit|fleece/i.test(ma) &&
    /linen/i.test(mb)
  ) {
    return `${ma} over ${mb.toLowerCase()} — warmer face, easier shirt underneath.`;
  }
  if (ma && mb) {
    return `${ma} and ${mb.toLowerCase()} hang as related halves.`;
  }
  return null;
}

export function whyCandidates(
  pieces: Garment[],
  routine: RoutineId,
  climate: Climate,
): Candidate[] {
  const top = topOf(pieces);
  const bottom = bottomOf(pieces);
  const outer = outerOf(pieces);
  const layer = layerOf(pieces);
  const out: Candidate[] = [];

  if (routine === "gym") {
    const shoes = pieces.find((g) => g.category === "footwear");
    if (top && bottom) {
      const line = hangTogether(top, bottom);
      if (line) out.push({ key: "color", score: 3, line });
    }
    if (shoes) {
      out.push({
        key: "footwear",
        score: 2,
        line: /black/i.test(`${shoes.name} ${shoes.colorName}`)
          ? "Black mesh trainers stay on the court. No leather."
          : "White mesh trainers stay on the court. No leather.",
      });
    }
    if (["hot", "warm", "mild"].includes(climate) && top && bottom && !layer) {
      out.push({
        key: "cloth",
        score: 2,
        line: "Nylon blend + cotton knit — built to move.",
      });
    }
    if (layer && top) {
      out.push({
        key: "climate_layer",
        score: 3,
        line: /hoodie/i.test(layer.name)
          ? "Fleece hoodie over a tee — gym layer, not a coat."
          : "Quarter-zip over a tee — gym layer, not a jacket.",
      });
      out.push({
        key: "occasion_formality",
        score: 2,
        line: /quarter[-\s]?zip/i.test(layer.name)
          ? "The zip layer stays lighter than a jacket."
          : "Fleece, not a coat.",
      });
    }
    return out.filter((c) => clean(c.line));
  }

  if (outer && /denim jacket/i.test(outer.name) && top) {
    out.push(
      pinnedWhy([outer, top]) ?? {
        key: "occasion_formality",
        score: 3,
        line: "Indigo denim over a knit — school register, not office.",
      },
    );
  }
  if (outer && /rain shell/i.test(outer.name) && top) {
    out.push({
      key: "climate_layer",
      score: 3,
      line: "Technical shell over a soft knit — crisp edge, easier body.",
    });
  }
  if (outer && /harrington/i.test(outer.name) && top) {
    out.push(
      pinnedWhy([outer, top]) ?? {
        key: "garment_role",
        score: 3,
        line: "Harrington over a crew — campus jacket line, not a blazer.",
      },
    );
  }
  if (!outer && top && ["hot", "warm", "mild"].includes(climate)) {
    out.push({
      key: "climate_layer",
      score: 2,
      line: "Open top line — no extra outer layer in the stack.",
    });
  }
  if (outer && top) {
    const stack = hangTogether(outer, top);
    if (stack && !out.some((c) => c.key === "color_or_texture_contrast")) {
      out.push({ key: "color_or_texture_contrast", score: 1, line: stack });
    }
  } else if (top && bottom) {
    const pair = hangTogether(top, bottom);
    if (pair) out.push({ key: "color_or_texture_contrast", score: 1, line: pair });
  }

  return out.filter((c) => clean(c.line)).sort((x, y) => y.score - x.score);
}

function lineForKey(
  pieces: Garment[],
  key: WhyKey,
  routine: RoutineId,
  climate: Climate,
): string {
  const hit = whyCandidates(pieces, routine, climate).find((c) => c.key === key);
  return hit?.line ?? "";
}

function replaceCat(
  pieces: Garment[],
  next: Garment,
  cat: Garment["category"] | "layer",
): Garment[] {
  const out = pieces.filter((g) => {
    if (cat === "layer") return !isGymLayer(g);
    if (cat === "tops") return g.category !== "tops" || isGymLayer(g);
    return g.category !== cat;
  });
  return [...out, next];
}

function schoolWant(key: WhyKey): RegExp | null {
  if (key === "occasion_formality") return /denim jacket/i;
  if (key === "climate_layer") return /rain shell/i;
  if (key === "garment_role") return /harrington/i;
  return null;
}

function swapForSlot(
  pieces: Garment[],
  closet: Garment[],
  key: WhyKey,
  routine: RoutineId,
  climate: Climate,
): Garment[] {
  if (routine !== "gym") {
    const want = schoolWant(key);
    if (want) {
      const outer = closet.find((g) => want.test(g.name));
      if (outer) {
        const kit = replaceCat(pieces, outer, "outerwear");
        if (lineForKey(kit, key, routine, climate)) return kit;
      }
    }
  }

  if (routine === "gym") {
    if (
      key === "color_or_texture_contrast" &&
      ["hot", "warm", "mild"].includes(climate)
    ) {
      const tee =
        closet.find((g) => g.id === "g_gym_tee") ??
        closet.find(
          (g) =>
            g.category === "tops" &&
            !isGymLayer(g) &&
            /heather/i.test(g.name) &&
            (g.formality === "athletic" ||
              (g.tags ?? []).some((t) => /gym/i.test(t))),
        );
      const jog =
        closet.find((g) => g.id === "g_gym_jogger") ??
        closet.find(
          (g) =>
            g.category === "bottoms" &&
            /jogger/i.test(g.name) &&
            /charcoal/i.test(g.name),
        );
      let kit = pieces;
      if (tee) kit = replaceCat(kit, tee, "tops");
      if (jog) kit = replaceCat(kit, jog, "bottoms");
      if (lineForKey(kit, key, routine, climate)) return kit;
    }
    if (key === "occasion_formality" && !layerOf(pieces)) {
      const sh = closet.find(
        (g) =>
          g.category === "footwear" &&
          /trainer|mesh|sneaker/i.test(`${g.name} ${g.material}`),
      );
      if (sh) {
        const kit = replaceCat(pieces, sh, "footwear");
        if (lineForKey(kit, key, routine, climate)) return kit;
      }
    }
  }

  if (lineForKey(pieces, key, routine, climate)) return pieces;

  const pool = closet.filter((g) => {
    if (pieces.some((p) => p.id === g.id)) return false;
    if (routine === "gym") {
      if (isCampusJacket(g)) return false;
      return (
        isGymLayer(g) ||
        g.formality === "athletic" ||
        (g.tags ?? []).some((t) => t.toLowerCase() === "gym")
      );
    }
    return !isGymLayer(g);
  });

  const cats: Array<Garment["category"] | "layer"> =
    routine === "gym"
      ? ["layer", "tops", "bottoms"]
      : ["outerwear", "tops", "bottoms"];
  for (const cat of cats) {
    const opts =
      cat === "layer"
        ? pool.filter(isGymLayer)
        : pool.filter(
            (g) => g.category === cat && (cat !== "tops" || !isGymLayer(g)),
          );
    for (const g of opts) {
      const kit = replaceCat(pieces, g, cat);
      if (lineForKey(kit, key, routine, climate)) return kit;
    }
  }
  return pieces;
}

function slotKeys(
  looks: Garment[][],
  routine: RoutineId,
  climate: Climate,
): WhyKey[] {
  if (routine === "gym" && ["hot", "warm", "mild"].includes(climate)) {
    return [
      "climate_layer",
      "color_or_texture_contrast",
      "occasion_formality",
    ];
  }
  const keys = [...SLOTS];
  if (routine === "gym" && ["cool", "cold", "snow", "rain"].includes(climate)) {
    const layerIdx = looks.findIndex((k) => k.some(isGymLayer));
    if (layerIdx >= 0) {
      const rest: WhyKey[] = [
        "occasion_formality",
        "color_or_texture_contrast",
      ];
      for (let i = 0; i < 3; i++) {
        keys[i] = i === layerIdx ? "climate_layer" : (rest.shift() ?? SLOTS[i]!);
      }
    }
  }
  return keys;
}

function merinoTop(g?: Garment) {
  return Boolean(g && /merino/i.test(`${g.name} ${g.material}`));
}

function pinnedWhy(pieces: Garment[]): Candidate | null {
  const outer = outerOf(pieces);
  const top = topOf(pieces);
  if (!outer || !top) return null;
  if (/harrington/i.test(outer.name) && merinoTop(top)) {
    return {
      key: "garment_role",
      score: 4,
      line: "Harrington over merino — campus jacket line, not a blazer.",
    };
  }
  if (/denim jacket/i.test(outer.name) && merinoTop(top)) {
    return {
      key: "occasion_formality",
      score: 4,
      line: "Indigo denim over merino — school register, not office.",
    };
  }
  return null;
}

function whyFromOuter(pieces: Garment[]): Candidate | null {
  const pinned = pinnedWhy(pieces);
  if (pinned) return pinned;
  const outer = outerOf(pieces);
  if (!outer) return null;
  if (/denim jacket/i.test(outer.name)) {
    return {
      key: "occasion_formality",
      score: 3,
      line: "Indigo denim — school register, not office.",
    };
  }
  if (/rain shell/i.test(outer.name)) {
    return {
      key: "climate_layer",
      score: 3,
      line: "Technical shell over a soft knit — crisp edge, easier body.",
    };
  }
  if (/harrington/i.test(outer.name)) {
    return {
      key: "garment_role",
      score: 3,
      line: "Harrington — campus jacket line, not a blazer.",
    };
  }
  return null;
}

export function whyPrimaryKey(
  pieces: Garment[],
  routine: RoutineId,
  climate: Climate,
): WhyKey | "" {
  if (routine === "gym") {
    return whyCandidates(pieces, routine, climate)[0]?.key ?? "";
  }
  const a = whyFromOuter(pieces);
  if (a) return a.key;
  return whyCandidates(pieces, routine, climate)[0]?.key ?? "";
}

/** Prefer distinct visual insights across a set of three. */
function assignInsights(
  looks: Garment[][],
  routine: RoutineId,
  climate: Climate,
): WhyInsight[] {
  const used = new Set<WhyInsight>();
  return looks.map((pieces, i) => {
    const key = whyPrimaryKey(pieces, routine, climate);
    let insight = key
      ? insightFromKey(key, i)
      : insightForIndex(i);
    // Force uniqueness across the three cards
    if (used.has(insight)) {
      const alt = WHY_INSIGHTS.find((x) => !used.has(x));
      if (alt) insight = alt;
    }
    used.add(insight);
    return insight;
  });
}

export function whyOne(
  pieces: Garment[],
  routine: RoutineId,
  climate: Climate,
  insight: WhyInsight = "tonal",
): string {
  return richWhy(pieces, routine, climate, insight);
}

export function whyForSet(
  looks: Garment[][],
  routine: RoutineId,
  climate: Climate,
): string[] {
  const insights = assignInsights(looks, routine, climate);
  const seenLines = new Set<string>();
  const seenOpenings = new Set<string>();
  const usedInsights = new Set<WhyInsight>();
  return looks.map((pieces, i) => {
    let insight = insights[i] ?? insightForIndex(i);
    if (usedInsights.has(insight)) {
      insight =
        WHY_INSIGHTS.find((x) => !usedInsights.has(x)) ?? insight;
    }
    let line = richWhy(pieces, routine, climate, insight);
    let opening = whyOpeningFingerprint(line);
    // Rotate until line and opening shell are unique across the three cards
    if (seenLines.has(line) || seenOpenings.has(opening)) {
      for (const next of WHY_INSIGHTS) {
        if (usedInsights.has(next) && next !== insight) continue;
        const alt = richWhy(pieces, routine, climate, next);
        const altOpen = whyOpeningFingerprint(alt);
        if (!seenLines.has(alt) && !seenOpenings.has(altOpen)) {
          line = alt;
          opening = altOpen;
          insight = next;
          break;
        }
      }
    }
    usedInsights.add(insight);
    seenLines.add(line);
    seenOpenings.add(opening);
    return line;
  });
}

/**
 * Optional kit-swap pass (school jacket slots) + distinct visual why lines.
 * Outfit picking still lives in board-set; this only nudges slot coverage.
 */
export function composeWhySet(
  looks: Garment[][],
  closet: Garment[],
  routine: RoutineId,
  climate: Climate,
): { kits: Garment[][]; lines: string[] } {
  const keys = slotKeys(looks, routine, climate);
  const kits: Garment[][] = [];
  looks.forEach((raw, i) => {
    const key = keys[i] ?? SLOTS[i % 3]!;
    kits.push(swapForSlot(raw, closet, key, routine, climate));
  });
  return { kits, lines: whyForSet(kits, routine, climate) };
}

import type { RoutineId } from "./routines";
import type { Climate, Garment } from "./types";

const FIT_RE =
  /\b(relaxed|oversized|fitted|straight(?:-leg)?|slim|cropped|tailored|loose|boxy|skinny|wide|knee[- ]length)\b/i;

const FILLER =
  /stylish and versatile|perfect for any|looks great together/gi;

const IMPRESSION: { test: RegExp; line: string }[] = [
  { test: /\bnavy\b/i, line: "calm and composed" },
  { test: /\b(indigo|blue)\b/i, line: "easy and composed" },
  { test: /\bblack\b/i, line: "sleek and confident" },
  { test: /\b(white|ivory)\b/i, line: "clean and fresh" },
  { test: /\b(grey|gray|charcoal|heather)\b/i, line: "understated" },
  { test: /\b(beige|cream|camel)\b/i, line: "warm and approachable" },
  { test: /\b(brown|tan)\b/i, line: "grounded and warm" },
  { test: /\b(olive|green)\b/i, line: "natural and calm" },
];

function isGymLayer(g: Garment): boolean {
  return /hoodie|quarter[-\s]?zip/i.test(`${g.name} ${g.notes}`);
}

function asRoutine(occasion: string): RoutineId {
  const o = occasion.toLowerCase();
  if (o === "school" || /\bschool\b/.test(o)) return "school";
  if (o === "gym" || /\bgym\b/.test(o)) return "gym";
  if (o === "weekend" || /\bweekend\b/.test(o)) return "weekend";
  if (o === "out" || /\bout\b/.test(o)) return "out";
  return "school";
}

export function article(phrase: string): string {
  const w = phrase.replace(/^(a|an)\s+/i, "").trim();
  if (!w) return phrase;
  if (/\b(shorts|jeans|trousers|joggers|sneakers|trainers)\b/i.test(w)) return w;
  return /^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`;
}

function uniqueColorNames(pieces: Garment[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const order = [
    "outerwear",
    "tops",
    "dresses",
    "bottoms",
    "footwear",
    "bags",
    "accessories",
  ] as const;
  const sorted = [...pieces].sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
  );
  for (const g of sorted) {
    const c = (g.colorName || "").trim();
    if (!c) continue;
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}

function impressionOf(colors: string[]): string {
  for (const c of colors) {
    for (const row of IMPRESSION) {
      if (row.test.test(c)) return row.line;
    }
  }
  return "";
}

function silhouetteOf(pieces: Garment[]): string {
  for (const g of pieces) {
    const m = `${g.name} ${g.notes}`.match(FIT_RE);
    if (m?.[1]) {
      return m[1]
        .toLowerCase()
        .replace("straight-leg", "straight")
        .replace("knee length", "knee-length");
    }
  }
  return "";
}

function listColors(colors: string[]): string {
  if (colors.length === 0) return "";
  if (colors.length === 1) return colors[0]!;
  if (colors.length === 2)
    return `${colors[0]} and ${colors[1]!.toLowerCase()}`;
  return `${colors[0]}, ${colors[1]!.toLowerCase()}, and ${colors[2]!.toLowerCase()}`;
}

function outerOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "outerwear" && !isGymLayer(g));
}
function topOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "tops" && !isGymLayer(g));
}
function bottomOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "bottoms");
}
function layerOf(pieces: Garment[]) {
  return pieces.find(isGymLayer);
}

function merinoTop(g?: Garment) {
  return Boolean(g && /merino/i.test(`${g.name} ${g.material}`));
}

/** Locked role beats — one clause, never the whole why. */
function roleBeat(
  pieces: Garment[],
  routine: RoutineId,
  climate: Climate,
): string {
  const outer = outerOf(pieces);
  const top = topOf(pieces);
  const layer = layerOf(pieces);
  const bottom = bottomOf(pieces);

  if (routine === "gym") {
    if (layer && top) {
      return /hoodie/i.test(layer.name)
        ? `${layer.name} over ${article(top.name.toLowerCase())} is the cold gym layer — fleece, not a coat`
        : `${layer.name} over ${article(top.name.toLowerCase())} is the gym layer, not a jacket`;
    }
    if (top && bottom) {
      return `${top.name} and ${bottom.name.toLowerCase()} stay athletic — floor kit, not a school jacket`;
    }
    return "The kit stays athletic — no school jacket";
  }

  if (outer && top) {
    if (/denim jacket/i.test(outer.name) && merinoTop(top)) {
      return "Indigo denim jacket over a black merino crew — school, not office";
    }
    if (/harrington/i.test(outer.name) && merinoTop(top)) {
      return "Navy harrington over a black merino crew is the campus jacket, not a blazer";
    }
    if (/denim jacket/i.test(outer.name)) {
      return `${outer.name} over ${article(top.name.toLowerCase())} — school, not office`;
    }
    if (/harrington/i.test(outer.name)) {
      return `${outer.name} over ${article(top.name.toLowerCase())} is the campus jacket, not a blazer`;
    }
    if (/rain shell|\brain\b/i.test(outer.name) || climate === "rain") {
      if (/rain shell|\brain\b/i.test(outer.name)) {
        return `${outer.name} over ${article(top.name.toLowerCase())} is the wet-weather layer, even on a mild day`;
      }
    }
  }
  return "";
}

function kitPair(pieces: Garment[]): string {
  const outer = outerOf(pieces) ?? layerOf(pieces);
  const top = topOf(pieces);
  if (outer && top) {
    return `${article(outer.name.toLowerCase())} and ${article(top.name.toLowerCase())}`;
  }
  const bottom = bottomOf(pieces);
  if (top && bottom) {
    return `${article(top.name.toLowerCase())} and ${article(bottom.name.toLowerCase())}`;
  }
  if (top) return article(top.name.toLowerCase());
  if (outer) return article(outer.name.toLowerCase());
  return "";
}

function colorVibe(colors: string[], impression: string, pieces: Garment[]): string {
  if (!colors.length) return "";
  const listed = listColors(colors);
  const verb = colors.length === 1 ? "reads" : "read";
  const feel = impression ? ` ${verb} ${impression}` : " hold the palette";
  const kit = kitPair(pieces);
  if (kit) return `${listed}${feel} on ${kit}.`;
  return `${listed}${feel}.`;
}

function occLabel(routine: RoutineId): string {
  if (routine === "school") return "school";
  if (routine === "gym") return "the gym";
  if (routine === "out") return "going out";
  return "the weekend";
}

function fitOccasion(
  sil: string,
  routine: RoutineId,
  pieces: Garment[],
): string {
  const occ = occLabel(routine);
  if (sil) {
    return `${article(sil).replace(/^a /, "A ").replace(/^an /, "An ")} cut keeps the outline for ${occ}.`;
  }
  const kit = kitPair(pieces);
  if (kit) return `The pieces stay right for ${occ}, without extra noise.`;
  return `It holds for ${occ}.`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clampWords(text: string, max = 50): string {
  let t = text.replace(FILLER, "").replace(/\s+/g, " ").trim();
  const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t];
  t = sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > max) {
    t = `${words.slice(0, max).join(" ").replace(/[.,;:—-]+$/, "")}.`;
  }
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

function endSentence(clause: string): string {
  let t = clause.trim().replace(/[.!?]+$/, "");
  if (!t) return "";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return `${t}.`;
}

function joinWhy(parts: string[]): string {
  return parts
    .map((p) => endSentence(p))
    .filter(Boolean)
    .join(" ");
}

export function richWhy(
  pieces: Garment[],
  occasion: RoutineId | string,
  climate: Climate,
): string {
  if (!pieces.length) return "";
  const routine = asRoutine(String(occasion));
  const colors = uniqueColorNames(pieces);
  const impression = impressionOf(colors);
  const sil = silhouetteOf(pieces);
  const beat = roleBeat(pieces, routine, climate);
  const s1 = colorVibe(colors, impression, pieces);
  const s2 = beat || fitOccasion(sil, routine, pieces);

  const parts = [s1, s2].filter(Boolean);
  if (parts.length < 2) {
    const extra = fitOccasion(sil, routine, pieces);
    if (extra && !parts.includes(extra)) parts.push(extra);
  }
  let text = joinWhy(parts);

  if (wordCount(text) < 25 && sil && !new RegExp(`\\b${sil}\\b`, "i").test(text)) {
    text = joinWhy([text, `${sil} through the line`]);
  }
  if (wordCount(text) < 25) {
    text = joinWhy([text, "The palette stays tight, nothing extra crowding the kit"]);
  }

  return clampWords(text, 50);
}

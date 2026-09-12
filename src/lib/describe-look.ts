import type { RoutineId } from "./routines";
import type { Climate, Garment } from "./types";

export type LookContext = {
  routine: RoutineId;
  climate: Climate;
};

export type LookFacts = {
  dominantColor: string;
  secondaryColors: string[];
  keyPieces: string[];
  silhouette: string;
  occasion: string;
  climateNote: string;
  impression: string;
};

const FIT_RE =
  /\b(relaxed|oversized|fitted|straight(?:-leg)?|slim|cropped|tailored|loose|boxy|skinny|wide|knee[- ]length)\b/i;

const OCCASION: Record<RoutineId, string> = {
  school: "school",
  weekend: "casual weekends",
  gym: "the gym",
  out: "going out",
};

const IMPRESSION: { test: RegExp; line: string }[] = [
  { test: /\bnavy\b/i, line: "calm, composed" },
  { test: /\b(indigo|blue)\b/i, line: "easy and composed" },
  { test: /\bblack\b/i, line: "sleek, confident" },
  { test: /\b(white|ivory)\b/i, line: "clean, fresh" },
  { test: /\b(grey|gray|charcoal|heather)\b/i, line: "understated" },
  { test: /\b(stone|khaki)\b/i, line: "grounded, understated" },
  { test: /\b(beige|cream|camel|sand)\b/i, line: "warm, approachable" },
  { test: /\b(brown|oak|espresso|tobacco|tan)\b/i, line: "grounded and warm" },
  { test: /\b(olive|green|forest)\b/i, line: "natural, calm" },
  { test: /\b(red|burgundy|wine)\b/i, line: "bold" },
  { test: /\byellow\b/i, line: "upbeat" },
  { test: /\b(orange|rust)\b/i, line: "warm, energetic" },
  { test: /\b(purple|plum)\b/i, line: "distinctive" },
];

const SLOT = [
  "outerwear",
  "tops",
  "dresses",
  "bottoms",
  "footwear",
  "bags",
  "accessories",
] as const;

function uniqueColors(pieces: Garment[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...pieces].sort(
    (a, b) => SLOT.indexOf(a.category) - SLOT.indexOf(b.category),
  );
  for (const p of sorted) {
    const c = (p.colorName || "").trim();
    if (!c) continue;
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function silhouetteOf(pieces: Garment[]): string {
  for (const p of pieces) {
    const m = `${p.name} ${p.notes}`.match(FIT_RE);
    if (m?.[1]) {
      return m[1]
        .toLowerCase()
        .replace("straight-leg", "straight")
        .replace("knee length", "knee-length");
    }
  }
  return "";
}

function impressionOf(colors: string[]): string {
  for (const c of colors) {
    for (const row of IMPRESSION) {
      if (row.test.test(c)) return row.line;
    }
  }
  return "";
}

function climateNote(climate: Climate, routine: RoutineId): string {
  if (routine === "gym") return "";
  if (climate === "rain") return "even in wet weather";
  if (climate === "hot" || climate === "warm") return "on milder days";
  if (climate === "cold" || climate === "snow") return "when it turns cold";
  return "";
}

function shortName(g: Garment): string {
  return g.name.replace(/^(the)\s+/i, "").toLowerCase();
}

function keyPiecesOf(pieces: Garment[]): string[] {
  const names: string[] = [];
  for (const cat of ["outerwear", "dresses", "tops", "bottoms"] as const) {
    const g = pieces.find((p) => p.category === cat);
    if (g) names.push(shortName(g));
    if (names.length >= 3) break;
  }
  if (names.length < 2) {
    const shoes = pieces.find((p) => p.category === "footwear");
    if (shoes) names.push(shortName(shoes));
  }
  return names;
}

function listAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items[0]}, ${items[1]}, and ${items[2]}`;
}

function colorPhrase(colors: string[]): string {
  if (colors.length === 0) return "";
  if (colors.length === 1) return colors[0]!;
  if (colors.length === 2)
    return `${colors[0]} and ${colors[1]!.toLowerCase()}`;
  return `${colors[0]}, ${colors[1]!.toLowerCase()}, and ${colors[2]!.toLowerCase()}`;
}

export function lookFacts(pieces: Garment[], ctx: LookContext): LookFacts {
  const colors = uniqueColors(pieces);
  return {
    dominantColor: colors[0] ?? "",
    secondaryColors: colors.slice(1, 3),
    keyPieces: keyPiecesOf(pieces),
    silhouette: silhouetteOf(pieces),
    occasion: OCCASION[ctx.routine] ?? "everyday wear",
    climateNote: climateNote(ctx.climate, ctx.routine),
    impression: impressionOf(colors),
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampLookCopy(text: string, max = 45): string {
  let t = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t];
  t = sentences
    .slice(0, 2)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > max) {
    t = `${words.slice(0, max).join(" ").replace(/[.,;:]+$/, "")}.`;
  }
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

function article(phrase: string): string {
  const w = phrase.replace(/^(a|an)\s+/i, "").trim();
  if (!w) return phrase;
  if (/\b(shorts|jeans|trousers|joggers|sneakers|trainers|chinos)\b/i.test(w)) {
    return w;
  }
  return /^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`;
}

function cap(phrase: string): string {
  if (!phrase) return phrase;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function kitPhrase(items: string[]): string {
  if (items.length === 0) return "";
  const marked = items.map((p, i) => (i === 0 ? article(p) : p));
  return listAnd(marked);
}

const FILLER =
  /stylish and versatile|perfect for any|effortlessly fashionable|looks great together/i;

export function copyFromFacts(facts: LookFacts, variety = 0): string {
  const colors = colorPhrase(
    [facts.dominantColor, ...facts.secondaryColors].filter(Boolean),
  );
  const kit = kitPhrase(facts.keyPieces);
  const piecesPlain = listAnd(facts.keyPieces);
  const sil = facts.silhouette;
  const occ = facts.occasion;
  const feel = facts.impression;
  const weather = facts.climateNote;
  const occTail = weather ? `${occ} ${weather}` : occ;
  const colorCount = [facts.dominantColor, ...facts.secondaryColors].filter(
    Boolean,
  ).length;
  const colorVerb = colorCount === 1 ? "keeps" : "keep";

  const drafts: string[] = [];
  if (colors && kit) {
    drafts.push(
      `${colors} give this a ${feel || "coherent"} palette, while ${kit} ${sil ? `keep the silhouette ${sil}` : "carry the look"} without looking sloppy. A strong option for ${occTail}.`,
    );
    drafts.push(
      `${sil ? `${cap(article(sil))} mix of ` : ""}${piecesPlain}${colors ? ` in ${colors.toLowerCase()}` : ""}${feel ? ` reads ${feel}` : ""}. Right for ${occTail}.`,
    );
    drafts.push(
      `${colors} sit on ${kit}${sil ? `, ${sil} through the line` : ""}. ${feel ? `The impression is ${feel} — ` : ""}a solid choice for ${occTail}.`,
    );
    drafts.push(
      `Built around ${kit}, ${colors.toLowerCase()} ${colorVerb} the look ${feel || "coherent"}${sil ? ` and ${sil}` : ""}. Fits ${occTail}.`,
    );
  } else if (kit) {
    drafts.push(
      `This look is built around ${kit}${silBit}. A strong option for ${occTail}.`,
    );
  } else {
    drafts.push(`A simple kit for ${occTail}.`);
  }

  const pick = (drafts[variety % drafts.length] ?? drafts[0]!).replace(
    FILLER,
    "",
  );
  return clampLookCopy(pick);
}

export function describeLook(
  pieces: Garment[],
  ctx: LookContext,
  variety = 0,
): string {
  if (!pieces.length) return "";
  return copyFromFacts(lookFacts(pieces, ctx), variety);
}

export function lookCopyWordCount(text: string): number {
  return wordCount(text);
}

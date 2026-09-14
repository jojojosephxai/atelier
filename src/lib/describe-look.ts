import {
  insightForIndex,
  richWhy,
} from "./rich-why.ts";
import type { RoutineId } from "./routines.ts";
import type { Climate, Garment } from "./types.ts";

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

export function lookFacts(pieces: Garment[], ctx: LookContext): LookFacts {
  const colors = uniqueColors(pieces);
  return {
    dominantColor: colors[0] ?? "",
    secondaryColors: colors.slice(1, 3),
    keyPieces: keyPiecesOf(pieces),
    silhouette: silhouetteOf(pieces),
    occasion: OCCASION[ctx.routine] ?? "everyday wear",
    // Weather belongs in climateNotes, not why copy
    climateNote: "",
    impression: "",
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampLookCopy(text: string, max = 55): string {
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

/** Shared path: same visual why engine as Today. */
export function copyFromFacts(
  facts: LookFacts,
  variety = 0,
  pieces: Garment[] = [],
  ctx?: LookContext,
): string {
  if (pieces.length && ctx) {
    return richWhy(
      pieces,
      ctx.routine,
      ctx.climate,
      insightForIndex(variety),
    );
  }
  // Minimal fallback when only facts are available (tests / stubs)
  const colors = [facts.dominantColor, ...facts.secondaryColors]
    .filter(Boolean)
    .slice(0, 2);
  const colorBit =
    colors.length === 2
      ? `${colors[0]} and ${colors[1]!.toLowerCase()} share the field`
      : colors[0]
        ? `${colors[0]} holds the field`
        : "The palette stays tight";
  const sil = facts.silhouette;
  const struct = sil
    ? `${sil.charAt(0).toUpperCase()}${sil.slice(1)} proportions keep one outline`
    : "Structure holds as one outline across the pieces";
  return clampLookCopy(`${colorBit}. ${struct}.`);
}

export function describeLook(
  pieces: Garment[],
  ctx: LookContext,
  variety = 0,
): string {
  if (!pieces.length) return "";
  return richWhy(pieces, ctx.routine, ctx.climate, insightForIndex(variety));
}

export function lookCopyWordCount(text: string): number {
  return wordCount(text);
}

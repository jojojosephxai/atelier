import type { Garment, Look, LookVoteMap, SuggestedLook } from "./types.ts";

const BODY = new Set(["tops", "dresses"]);
const BOTTOM = new Set(["bottoms"]);
const CORE = new Set(["outerwear", "tops", "bottoms", "dresses", "footwear"]);

export function piecesOf(
  ids: string[],
  garments: Garment[],
): Garment[] {
  return ids
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => Boolean(g));
}

export function lookHasBody(pieces: Garment[]): boolean {
  const dress = pieces.some((p) => p.category === "dresses");
  if (dress) return true;
  return (
    pieces.some((p) => BODY.has(p.category)) &&
    pieces.some((p) => BOTTOM.has(p.category))
  );
}

export function lookIsWearable(
  look: Pick<Look, "garmentIds"> | Pick<SuggestedLook, "garmentIds">,
  garments: Garment[],
): boolean {
  return lookHasBody(piecesOf(look.garmentIds, garments));
}

export function slotOf(g: Garment): Garment["category"] {
  return g.category;
}

export function isShorts(g: Garment): boolean {
  return /\bshorts?\b/i.test(`${g.name} ${g.notes}`);
}

export function isCoat(g: Garment): boolean {
  if (g.category !== "outerwear") return false;
  return /\b(coat|overcoat|parka|trench|peacoat|topcoat)\b/i.test(
    `${g.name} ${g.notes} ${g.material}`,
  );
}

export function comboKey(ids: string[]): string {
  return [...ids].filter(Boolean).sort().join("|");
}

export function lookCoreKey(ids: string[], garments: Garment[]): string {
  return ids
    .filter((id) => {
      const g = garments.find((x) => x.id === id);
      return g && CORE.has(g.category);
    })
    .sort()
    .join("|");
}

export function likedGarmentIds(votes: LookVoteMap | undefined): string[] {
  if (!votes) return [];
  const ids = new Set<string>();
  for (const [key, raw] of Object.entries(votes)) {
    const pol = typeof raw === "number" ? raw : raw.vote;
    if (pol !== 1) continue;
    const blob =
      typeof raw === "number" ? key : raw.garmentIdsSorted || key;
    for (const id of blob.split(/[|:]+/)) {
      if (id && id.startsWith("g_")) ids.add(id);
    }
  }
  return [...ids];
}

export function skippedLookKeys(votes: LookVoteMap | undefined): string[] {
  if (!votes) return [];
  const keys: string[] = [];
  for (const [key, raw] of Object.entries(votes)) {
    const pol = typeof raw === "number" ? raw : raw.vote;
    if (pol !== -1) continue;
    if (typeof raw === "number") keys.push(key);
    else if (raw.garmentIdsSorted) keys.push(raw.garmentIdsSorted);
    else keys.push(key);
  }
  return keys;
}

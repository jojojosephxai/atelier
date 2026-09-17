import { isGymLayer } from "./board-set";
import { comboKey, piecesOf } from "./look";
import type { Climate, Garment, LookVote, LookVoteMap } from "./types";
import type { RoutineId } from "./routines";
import { whyPrimaryKey } from "./why-compose";

export const THUMB_WINDOW = 8;
const THUMB_PER = 3;
const THUMB_CAP = 8;

export function closetSig(garments: Garment[]): string {
  return garments
    .map((g) => g.id)
    .sort()
    .join("|");
}

export function voteRecordKey(
  occasion: string,
  climate: string,
  combo: string,
): string {
  return `${occasion}:${climate}:${combo}`;
}

export function votePolarity(
  entry: LookVote | 1 | -1 | undefined,
): 1 | -1 | 0 {
  if (!entry) return 0;
  if (typeof entry === "number") return entry;
  return entry.vote;
}

export function asLookVote(
  key: string,
  entry: LookVote | 1 | -1,
): LookVote {
  if (typeof entry !== "number") return entry;
  const parts = key.split(":");
  if (parts.length >= 3) {
    return {
      garmentIdsSorted: parts.slice(2).join(":"),
      occasion: parts[0] ?? "",
      climate: (parts[1] ?? "mild") as Climate,
      whyKey: "",
      vote: entry,
      at: 0,
    };
  }
  return {
    garmentIdsSorted: key,
    occasion: "",
    climate: "mild",
    whyKey: "",
    vote: entry,
    at: 0,
  };
}

function liveDown(
  vote: LookVote,
  occasion: string,
  climate: Climate,
  regen: number,
  sig: string,
): boolean {
  if (vote.vote !== -1) return false;
  if (vote.occasion && vote.occasion !== occasion) return false;
  if (vote.climate && vote.climate !== climate) return false;
  if (vote.closetSig && vote.closetSig !== sig) return false;
  const gen = vote.gen ?? 0;
  return regen - gen < THUMB_WINDOW;
}

export function recentDowns(
  votes: LookVoteMap | undefined,
  occasion: string,
  climate: Climate,
  regen: number,
  sig: string,
): LookVote[] {
  if (!votes) return [];
  const out: LookVote[] = [];
  for (const [key, raw] of Object.entries(votes)) {
    const vote = asLookVote(key, raw);
    if (liveDown(vote, occasion, climate, regen, sig)) out.push(vote);
  }
  return out;
}

export function recentUps(
  votes: LookVoteMap | undefined,
  occasion: string,
  climate: Climate,
): LookVote[] {
  if (!votes) return [];
  const out: LookVote[] = [];
  for (const [key, raw] of Object.entries(votes)) {
    const vote = asLookVote(key, raw);
    if (vote.vote !== 1) continue;
    if (vote.occasion && vote.occasion !== occasion) continue;
    if (vote.climate && vote.climate !== climate) continue;
    out.push(vote);
  }
  return out;
}

export function skipCombosFrom(downs: LookVote[]): Set<string> {
  return new Set(downs.map((v) => v.garmentIdsSorted).filter(Boolean));
}

export function skipWhyFrom(downs: LookVote[]): Set<string> {
  return new Set(downs.map((v) => v.whyKey).filter(Boolean));
}

type Feat = {
  outerId: string;
  outerRole: string;
  topId: string;
  bottomId: string;
  footwearId: string;
  whyKey: string;
};

function features(pieces: Garment[], whyKey: string): Feat {
  const layer = pieces.find(isGymLayer);
  const outer = pieces.find((g) => g.category === "outerwear" && !isGymLayer(g));
  const top =
    pieces.find((g) => g.category === "tops" && !isGymLayer(g)) ??
    pieces.find((g) => g.category === "dresses");
  const bottom = pieces.find((g) => g.category === "bottoms");
  const footwear = pieces.find((g) => g.category === "footwear");
  return {
    outerId: (layer ?? outer)?.id ?? "",
    outerRole: layer ? "layer" : outer ? "outer" : "none",
    topId: top?.id ?? "",
    bottomId: bottom?.id ?? "",
    footwearId: footwear?.id ?? "",
    whyKey,
  };
}

function featFromVote(vote: LookVote, garments: Garment[]): Feat {
  const ids = vote.garmentIdsSorted.split("|").filter(Boolean);
  const pieces = piecesOf(ids, garments);
  return features(pieces, vote.whyKey);
}

function overlap(a: Feat, b: Feat): number {
  let n = 0;
  if (
    (a.outerId && a.outerId === b.outerId) ||
    (a.outerRole !== "none" && a.outerRole === b.outerRole)
  ) {
    n += 1;
  }
  if (a.topId && a.topId === b.topId) n += 1;
  if (a.bottomId && a.bottomId === b.bottomId) n += 1;
  if (a.footwearId && a.footwearId === b.footwearId) n += 1;
  if (a.whyKey && a.whyKey === b.whyKey) n += 1;
  return n;
}

export function thumbBonus(
  pieces: Garment[],
  ups: LookVote[],
  garments: Garment[],
  routine: RoutineId,
  climate: Climate,
): number {
  if (!ups.length) return 0;
  const whyKey = whyPrimaryKey(pieces, routine, climate);
  const self = features(pieces, whyKey);
  let bonus = 0;
  for (const vote of ups) {
    const hit = overlap(self, featFromVote(vote, garments));
    if (hit >= 2) bonus += Math.min(THUMB_PER, hit);
  }
  return Math.min(THUMB_CAP, bonus);
}

export function isSuppressedLook(
  ids: string[],
  pieces: Garment[],
  downs: LookVote[],
  routine: RoutineId,
  climate: Climate,
): boolean {
  if (!downs.length) return false;
  const combo = comboKey(ids);
  if (skipCombosFrom(downs).has(combo)) return true;
  const why = whyPrimaryKey(pieces, routine, climate);
  return Boolean(why) && skipWhyFrom(downs).has(why);
}

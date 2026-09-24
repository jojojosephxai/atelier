import { comboKey, lookCoreKey } from "./look.ts";
import type { Climate, Garment, LookVoteMap } from "./types.ts";

/** Shown kit and the suggestion's own ids, so a downvote matches either key. */
export function dislikeCombos(shownIds: string[], sourceIds: string[]): string[] {
  const combos: string[] = [];
  for (const ids of [shownIds, sourceIds]) {
    const combo = comboKey(ids);
    if (combo && !combos.includes(combo)) combos.push(combo);
  }
  return combos;
}

export function commitDislikeVotes(
  votes: LookVoteMap | undefined,
  combos: string[],
  entry: {
    occasion: string;
    climate: Climate;
    whyKey: string;
    at: number;
    gen: number;
    closetSig: string;
  },
): LookVoteMap {
  const next: LookVoteMap = { ...(votes ?? {}) };
  for (const combo of combos) {
    if (!combo) continue;
    // Same key shape as voteRecordKey in look-votes.ts.
    const key = `${entry.occasion}:${entry.climate}:${combo}`;
    next[key] = {
      garmentIdsSorted: combo,
      occasion: entry.occasion,
      climate: entry.climate,
      whyKey: entry.whyKey,
      vote: -1,
      at: entry.at,
      gen: entry.gen,
      closetSig: entry.closetSig,
    };
  }
  return next;
}

/** True when this preset was thumbs-downed, so the row must not fill itself with it. */
export function dislikeSkipsPreset(
  garmentIds: string[],
  garments: Garment[],
  skip: ReadonlySet<string>,
): boolean {
  const combo = comboKey(garmentIds);
  const core = lookCoreKey(garmentIds, garments);
  const key = core || combo;
  return Boolean((combo && skip.has(combo)) || (key && skip.has(key)));
}

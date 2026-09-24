import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitDislikeVotes,
  dislikeCombos,
  dislikeSkipsPreset,
} from "./dislike-confirm.ts";
import { comboKey, lookCoreKey } from "./look.ts";
import type { Garment } from "./types.ts";

function garment(
  partial: Pick<Garment, "id" | "name" | "category"> & Partial<Garment>,
): Garment {
  return {
    brand: "",
    material: "Cotton",
    formality: "casual",
    seasons: ["all"],
    climate: ["mild"],
    notes: "",
    tags: ["School"],
    createdAt: 0,
    colorName: "Grey",
    hex: "#888888",
    ...partial,
  };
}

const closet: Garment[] = [
  garment({ id: "outer_denim", name: "Denim jacket", category: "outerwear" }),
  garment({ id: "top_tee", name: "Grey tee", category: "tops" }),
  garment({ id: "bottom_jean", name: "Indigo jean", category: "bottoms" }),
  garment({ id: "shoe", name: "White sneaker", category: "footwear" }),
  garment({ id: "bag", name: "Black tote", category: "bags" }),
];

describe("dislike confirm", () => {
  it("records the shown kit and the source kit once each", () => {
    const votes = commitDislikeVotes(
      { keep: 1 },
      dislikeCombos(["top_tee", "bag"], ["top_tee"]),
      {
        occasion: "school",
        climate: "mild",
        whyKey: "why",
        at: 5,
        gen: 1,
        closetSig: "sig",
      },
    );
    const shown = comboKey(["top_tee", "bag"]);
    const source = comboKey(["top_tee"]);
    const shownVote = votes[`school:mild:${shown}`];
    const sourceVote = votes[`school:mild:${source}`];
    assert.equal(votes.keep, 1);
    assert.equal(typeof shownVote === "object" ? shownVote.vote : shownVote, -1);
    assert.equal(typeof sourceVote === "object" ? sourceVote.vote : sourceVote, -1);
    assert.equal(typeof shownVote === "object" ? shownVote.garmentIdsSorted : "", shown);
    assert.deepEqual(dislikeCombos(["top_tee"], ["top_tee"]), [comboKey(["top_tee"])]);
  });

  it("skips a preset whose combo or core was disliked", () => {
    const ids = closet.map((g) => g.id);
    const combo = comboKey(ids);
    const core = lookCoreKey(ids, closet);
    assert.equal(dislikeSkipsPreset(ids, closet, new Set([combo])), true);
    assert.equal(dislikeSkipsPreset(ids, closet, new Set([core])), true);
    assert.equal(dislikeSkipsPreset(ids, closet, new Set(["other"])), false);
  });
});
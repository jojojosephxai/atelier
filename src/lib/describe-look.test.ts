import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampLookCopy,
  copyFromFacts,
  lookCopyWordCount,
  lookFacts,
} from "./describe-look.ts";
import type { Garment } from "./types.ts";

function g(
  partial: Pick<Garment, "id" | "name" | "category" | "colorName"> &
    Partial<Garment>,
): Garment {
  return {
    brand: "",
    hex: "#000000",
    material: "",
    formality: "casual",
    seasons: ["all"],
    climate: ["mild"],
    notes: "",
    tags: [],
    createdAt: 0,
    ...partial,
  };
}

describe("clampLookCopy", () => {
  it("keeps two sentences and caps words", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const out = clampLookCopy(`${long}. Extra sentence that should drop.`);
    assert.ok(lookCopyWordCount(out) <= 55);
    assert.equal((out.match(/[.!?]/g) || []).length >= 1, true);
  });

  it("strips bullets and headings", () => {
    const out = clampLookCopy("# Title\n- Navy coat\nBlack trousers finish it.");
    assert.doesNotMatch(out, /#|-/);
    assert.ok(out.toLowerCase().includes("navy"));
  });
});

describe("copyFromFacts", () => {
  it("never claims the wearer's personality", () => {
    const text = copyFromFacts(
      {
        dominantColor: "Navy",
        secondaryColors: ["Ivory"],
        keyPieces: ["navy harrington", "ivory linen shirt"],
        silhouette: "relaxed",
        occasion: "school",
        climateNote: "",
        impression: "",
      },
      0,
    );
    assert.doesNotMatch(text, /you are|wearer is|trustworthy|intelligent/i);
    assert.match(text, /navy/i);
  });

  it("lookFacts drops climate from why facts", () => {
    const pieces = [
      g({
        id: "1",
        name: "Navy rain shell",
        category: "outerwear",
        colorName: "Navy",
        hex: "#1c2a4a",
      }),
    ];
    const facts = lookFacts(pieces, { routine: "school", climate: "rain" });
    assert.equal(facts.climateNote, "");
  });
});

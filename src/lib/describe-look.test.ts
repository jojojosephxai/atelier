import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampLookCopy,
  copyFromFacts,
  describeLook,
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

function assertCaption(text: string) {
  const n = lookCopyWordCount(text);
  assert.ok(n >= 18 && n <= 45, `"${text}" is ${n} words`);
  assert.equal((text.match(/\n/g) || []).length, 0);
  assert.doesNotMatch(text, /psychologically|trustworthy person|you are/i);
}

describe("clampLookCopy", () => {
  it("keeps two sentences and caps at 45 words", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const out = clampLookCopy(`${long}. Extra sentence that should drop.`);
    assert.ok(lookCopyWordCount(out) <= 45);
    assert.equal((out.match(/[.!?]/g) || []).length >= 1, true);
  });

  it("strips bullets and headings", () => {
    const out = clampLookCopy("# Title\n- Navy coat\nBlack trousers finish it.");
    assert.doesNotMatch(out, /#|-/);
    assert.ok(out.toLowerCase().includes("navy"));
  });
});

describe("describeLook", () => {
  it("monochrome black oversized hoodie", () => {
    const pieces = [
      g({
        id: "1",
        name: "Black oversized hoodie",
        category: "tops",
        colorName: "Black",
        notes: "Oversized fleece. Gym and weekend.",
        formality: "athletic",
      }),
      g({
        id: "2",
        name: "Charcoal joggers",
        category: "bottoms",
        colorName: "Charcoal",
        formality: "athletic",
      }),
      g({
        id: "3",
        name: "Black trainers",
        category: "footwear",
        colorName: "Black",
      }),
    ];
    const text = describeLook(pieces, { routine: "gym", climate: "mild" }, 0);
    assertCaption(text);
    assert.match(text, /black/i);
    assert.match(text, /hoodie|joggers/i);
    assert.match(text, /oversized|gym/i);
    const facts = lookFacts(pieces, { routine: "gym", climate: "mild" });
    assert.equal(facts.silhouette, "oversized");
    assert.equal(facts.dominantColor, "Black");
  });

  it("navy and cream smart-casual", () => {
    const pieces = [
      g({
        id: "1",
        name: "Navy harrington",
        category: "outerwear",
        colorName: "Navy",
        notes: "Relaxed campus jacket.",
        formality: "smart-casual",
      }),
      g({
        id: "2",
        name: "Ivory linen shirt",
        category: "tops",
        colorName: "Ivory",
        material: "Linen",
      }),
      g({
        id: "3",
        name: "Charcoal trousers",
        category: "bottoms",
        colorName: "Charcoal",
        notes: "Straight-leg.",
        formality: "smart-casual",
      }),
    ];
    const text = describeLook(pieces, { routine: "school", climate: "cool" }, 1);
    assertCaption(text);
    assert.match(text, /navy/i);
    assert.match(text, /ivory|cream|linen|harrington/i);
    assert.match(text, /school/i);
    assert.doesNotMatch(text, /date night/i);
    const facts = lookFacts(pieces, { routine: "school", climate: "cool" });
    assert.equal(facts.silhouette, "relaxed");
  });

  it("olive colorful casual weekend", () => {
    const pieces = [
      g({
        id: "1",
        name: "Olive overshirt",
        category: "outerwear",
        colorName: "Olive",
        notes: "Loose overshirt.",
      }),
      g({
        id: "2",
        name: "White tee",
        category: "tops",
        colorName: "White",
      }),
      g({
        id: "3",
        name: "Khaki chinos",
        category: "bottoms",
        colorName: "Khaki",
      }),
    ];
    const text = describeLook(
      pieces,
      { routine: "weekend", climate: "warm" },
      2,
    );
    assertCaption(text);
    assert.match(text, /olive/i);
    assert.match(text, /weekend/i);
    assert.doesNotMatch(text, /tailored wool/i);
  });

  it("fitted formal navy", () => {
    const pieces = [
      g({
        id: "1",
        name: "Navy wool overcoat",
        category: "outerwear",
        colorName: "Navy",
        material: "Wool",
        formality: "business",
        notes: "Knee length. Quiet structure.",
      }),
      g({
        id: "2",
        name: "White oxford shirt",
        category: "tops",
        colorName: "White",
        formality: "business",
      }),
      g({
        id: "3",
        name: "Charcoal trousers",
        category: "bottoms",
        colorName: "Charcoal",
        formality: "business",
        notes: "Tailored.",
      }),
      g({
        id: "4",
        name: "Black oxfords",
        category: "footwear",
        colorName: "Black",
        formality: "formal",
      }),
    ];
    const text = describeLook(pieces, { routine: "out", climate: "cold" }, 3);
    assertCaption(text);
    assert.match(text, /navy/i);
    assert.match(text, /going out|out/i);
    const facts = lookFacts(pieces, { routine: "out", climate: "cold" });
    assert.equal(facts.silhouette, "knee-length");
  });

  it("does not invent fit when notes are empty", () => {
    const pieces = [
      g({
        id: "1",
        name: "Grey tee",
        category: "tops",
        colorName: "Grey",
      }),
      g({
        id: "2",
        name: "Black jeans",
        category: "bottoms",
        colorName: "Black",
      }),
    ];
    const facts = lookFacts(pieces, { routine: "school", climate: "mild" });
    assert.equal(facts.silhouette, "");
    const text = describeLook(pieces, { routine: "school", climate: "mild" });
    assertCaption(text);
    assert.doesNotMatch(text, /tailored|oversized|slim|boxy/i);
  });

  it("varies openings without repeating the same sentence", () => {
    const pieces = [
      g({
        id: "1",
        name: "Denim jacket",
        category: "outerwear",
        colorName: "Indigo",
      }),
      g({
        id: "2",
        name: "Heather grey tee",
        category: "tops",
        colorName: "Grey",
      }),
      g({
        id: "3",
        name: "Black jeans",
        category: "bottoms",
        colorName: "Black",
      }),
    ];
    const a = describeLook(pieces, { routine: "school", climate: "mild" }, 0);
    const b = describeLook(pieces, { routine: "school", climate: "mild" }, 1);
    const c = describeLook(pieces, { routine: "school", climate: "mild" }, 2);
    assert.notEqual(a, b);
    assert.notEqual(b, c);
    for (const t of [a, b, c]) assertCaption(t);
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
        impression: "calm, composed",
      },
      0,
    );
    assert.doesNotMatch(text, /you are|wearer is|trustworthy|intelligent/i);
    assert.match(text, /navy/i);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { richWhy } from "./rich-why.ts";
import type { Climate, Garment } from "./types.ts";

function g(
  partial: Pick<Garment, "id" | "name" | "category" | "colorName"> &
    Partial<Garment>,
): Garment {
  return {
    brand: "",
    hex: "#808080",
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

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+/g) ?? []).map((s) => s.trim());
}

function assertVisualWhy(text: string, climate: Climate = "mild") {
  const bits = sentences(text);
  assert.equal(bits.length, 2, `"${text}" should be two sentences`);
  const n = text.trim().split(/\s+/).length;
  assert.ok(n >= 18 && n <= 50, `"${text}" is ${n} words`);
  assert.doesNotMatch(text, /psychologically|trustworthy person|you are/i);
  assert.doesNotMatch(text, /wet-weather|even on a mild day|weather-ready/i);
  if (climate !== "rain" && climate !== "snow") {
    assert.doesNotMatch(text, /\b(rain|snow|wet|mild day)\b/i);
  }
  assert.match(
    text,
    /tonal|monochrome|mute|accent|value|contrast|register|stacked|break/i,
  );
  assert.match(
    text,
    /texture|outline|nylon|knit|denim|fleece|cotton|wool|linen|cut|volume|hang|shell|jacket|face/i,
  );
}

describe("richWhy", () => {
  it("rain shell look: palette + structure, no title pair, no weather on mild", () => {
    const pieces = [
      g({
        id: "g_rain_shell",
        name: "Navy rain shell",
        category: "outerwear",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "Nylon",
        notes: "Wet-weather layer, even on a mild day.",
      }),
      g({
        id: "g_navy_knit",
        name: "Navy polo knit",
        category: "tops",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "Cotton knit",
      }),
      g({
        id: "g_olive_chino",
        name: "Olive chinos",
        category: "bottoms",
        colorName: "Olive",
        hex: "#5c6040",
        material: "Cotton twill",
        notes: "Soft taper. Travel trousers.",
      }),
      g({
        id: "g_white_sneaker",
        name: "White sneakers",
        category: "footwear",
        colorName: "White",
        hex: "#f7f7f4",
      }),
    ];
    const text = richWhy(pieces, "school", "mild");
    assertVisualWhy(text, "mild");
    assert.match(text, /navy/i);
    assert.match(text, /olive/i);
    assert.match(text, /white/i);
    assert.match(text, /chinos|trainers|sneakers|shoes/i);
    assert.doesNotMatch(text, /rain shell over/i);
    assert.doesNotMatch(text, /navy rain shell/i);
    assert.doesNotMatch(text, /navy polo knit/i);
    assert.doesNotMatch(text, /calm and composed/i);
  });

  it("may mention rain only when rain is the brief", () => {
    const pieces = [
      g({
        id: "g_rain_shell",
        name: "Navy rain shell",
        category: "outerwear",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "Nylon",
      }),
      g({
        id: "g_navy_knit",
        name: "Navy polo knit",
        category: "tops",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "Cotton knit",
      }),
    ];
    const mild = richWhy(pieces, "school", "mild");
    const rain = richWhy(pieces, "school", "rain");
    assertVisualWhy(mild, "mild");
    assertVisualWhy(rain, "rain");
    assert.doesNotMatch(mild, /\brain\b/i);
    assert.match(rain, /\brain\b/i);
    assert.doesNotMatch(rain, /wet-weather layer/i);
  });

  it("does not restate a harrington + merino title pair", () => {
    const pieces = [
      g({
        id: "g_navy_harrington",
        name: "Navy harrington",
        category: "outerwear",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "Cotton",
        notes: "Relaxed campus jacket.",
        formality: "smart-casual",
      }),
      g({
        id: "g_black_merino",
        name: "Black merino crew",
        category: "tops",
        colorName: "Black",
        hex: "#1a1a1a",
        material: "Merino",
      }),
      g({
        id: "g_charcoal_trouser",
        name: "Charcoal wool trousers",
        category: "bottoms",
        colorName: "Charcoal",
        hex: "#3a3a3c",
        material: "Wool",
        notes: "Straight-leg.",
      }),
    ];
    const text = richWhy(pieces, "school", "cool");
    assertVisualWhy(text, "cool");
    assert.doesNotMatch(text, /harrington over/i);
    assert.doesNotMatch(text, /navy harrington/i);
    assert.doesNotMatch(text, /black merino crew/i);
    assert.match(text, /because|so the|rather than/i);
  });

  it("gym hoodie: fit psychology without repeating hoodie over tee", () => {
    const pieces = [
      g({
        id: "g_black_hoodie",
        name: "Black oversized hoodie",
        category: "tops",
        colorName: "Black",
        hex: "#1a1a1a",
        material: "Fleece",
        notes: "Oversized fleece. Gym and weekend.",
        formality: "athletic",
      }),
      g({
        id: "g_gym_tee",
        name: "Heather grey tee",
        category: "tops",
        colorName: "Grey",
        hex: "#8a8a8a",
        material: "Cotton",
        formality: "athletic",
      }),
      g({
        id: "g_gym_jogger",
        name: "Charcoal joggers",
        category: "bottoms",
        colorName: "Charcoal",
        hex: "#3a3a3c",
        material: "Nylon blend",
        formality: "athletic",
      }),
    ];
    const text = richWhy(pieces, "gym", "mild");
    assertVisualWhy(text, "mild");
    assert.doesNotMatch(text, /hoodie over/i);
    assert.doesNotMatch(text, /cold gym layer/i);
    assert.match(text, /oversized|volume|fleece|joggers/i);
  });
});

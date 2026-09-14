import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  insightForIndex,
  richWhy,
  whyOpeningFingerprint,
  type WhyInsight,
  WHY_INSIGHTS,
} from "./rich-why.ts";
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

const JARGON =
  /value contrast|loud break|texture break|as the ground|frames a softer|sharper outer|softer body|\w+ against [\w ]+ is (?:the |a )?(?:value |texture )?(?:contrast|break)/i;

function assertVisualWhy(text: string, climate: Climate = "mild") {
  const bits = sentences(text);
  assert.equal(bits.length, 2, `"${text}" should be two sentences`);
  const n = text.trim().split(/\s+/).length;
  assert.ok(n >= 18 && n <= 50, `"${text}" is ${n} words`);
  assert.doesNotMatch(text, /psychologically|trustworthy person|you are/i);
  assert.doesNotMatch(text, /wet-weather|even on a mild day|weather-ready/i);
  assert.doesNotMatch(text, JARGON);
  if (climate !== "rain" && climate !== "snow") {
    assert.doesNotMatch(text, /\b(rain|snow|wet|mild day)\b/i);
  }
}

const navyIvoryOlive = [
  g({
    id: "g_navy_harrington",
    name: "Navy harrington",
    category: "outerwear",
    colorName: "Navy",
    hex: "#1c2a4a",
    material: "Cotton",
    notes: "Relaxed campus jacket.",
  }),
  g({
    id: "g_ivory_linen",
    name: "Ivory linen shirt",
    category: "tops",
    colorName: "Ivory",
    hex: "#f3eee4",
    material: "Linen",
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

describe("richWhy", () => {
  it("navy/ivory/olive: names garments, no jargon shell, materials only from fields", () => {
    const text = richWhy(navyIvoryOlive, "school", "mild", "texture");
    assertVisualWhy(text, "mild");
    assert.match(text, /ivory/i);
    assert.match(text, /navy/i);
    assert.match(text, /olive/i);
    assert.match(text, /shirt|jacket|chinos/i);
    assert.match(text, /chinos/i);
    // Materials present in data may appear; invented cotton-vs-linen without fields would be wrong —
    // here both materials exist, so cotton/linen claims are allowed when used.
    assert.doesNotMatch(text, /navy harrington|ivory linen shirt/i);
    assert.doesNotMatch(text, /harrington over/i);
    assert.doesNotMatch(text, JARGON);
  });

  it("does not invent materials when fields are empty", () => {
    const pieces = [
      g({
        id: "o",
        name: "Navy jacket",
        category: "outerwear",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "",
      }),
      g({
        id: "t",
        name: "Ivory shirt",
        category: "tops",
        colorName: "Ivory",
        hex: "#f3eee4",
        material: "",
      }),
      g({
        id: "b",
        name: "Olive chinos",
        category: "bottoms",
        colorName: "Olive",
        hex: "#5c6040",
        material: "",
      }),
    ];
    const text = richWhy(pieces, "school", "mild", "texture");
    assertVisualWhy(text, "mild");
    assert.doesNotMatch(text, /\b(cotton|linen|nylon|wool|denim|fleece)\b/i);
  });

  it("each insight uses a different opening architecture", () => {
    const openings = new Set<string>();
    const lines = new Set<string>();
    for (const insight of [
      "tonal",
      "accent",
      "texture",
      "silhouette",
    ] as WhyInsight[]) {
      const text = richWhy(navyIvoryOlive, "school", "mild", insight);
      assertVisualWhy(text, "mild");
      const fp = whyOpeningFingerprint(text);
      assert.ok(!openings.has(fp), `duplicate opening shell for ${insight}: ${fp}`);
      openings.add(fp);
      assert.ok(!lines.has(text), `duplicate full line for ${insight}`);
      lines.add(text);
    }
  });

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
    assert.match(text, /chinos|sneakers|shoes|shell|knit/i);
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
    const rain = richWhy(pieces, "school", "rain", "texture");
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
    const text = richWhy(pieces, "school", "cool", "silhouette");
    assertVisualWhy(text, "cool");
    assert.doesNotMatch(text, /harrington over/i);
    assert.doesNotMatch(text, /navy harrington/i);
    assert.doesNotMatch(text, /black merino crew/i);
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
    const text = richWhy(pieces, "gym", "mild", "silhouette");
    assertVisualWhy(text, "mild");
    assert.doesNotMatch(text, /hoodie over/i);
    assert.doesNotMatch(text, /cold gym layer/i);
    assert.match(text, /oversized|volume|fleece|joggers/i);
  });

  it("Today set simulation: three looks × three insights → distinct openings", () => {
    const lookA = navyIvoryOlive;
    const lookB = [
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
      g({
        id: "g_olive_chino",
        name: "Olive chinos",
        category: "bottoms",
        colorName: "Olive",
        hex: "#5c6040",
        material: "Cotton twill",
      }),
      g({
        id: "g_white_sneaker",
        name: "White sneakers",
        category: "footwear",
        colorName: "White",
        hex: "#f7f7f4",
      }),
    ];
    const lookC = [
      g({
        id: "g_denim_jacket",
        name: "Indigo denim jacket",
        category: "outerwear",
        colorName: "Indigo",
        hex: "#2c3a6a",
        material: "Denim",
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
        id: "g_indigo_jean",
        name: "Dark indigo jeans",
        category: "bottoms",
        colorName: "Indigo",
        hex: "#2c3a6a",
        material: "Denim",
        notes: "Straight.",
      }),
    ];
    const looks = [lookA, lookB, lookC];
    const insights = looks.map((_, i) => insightForIndex(i));
    assert.equal(new Set(insights).size, 3);
    assert.deepEqual(insights.slice(0, 3), WHY_INSIGHTS.slice(0, 3));
    const lines = looks.map((pieces, i) =>
      richWhy(pieces, "school", "mild", insights[i]!),
    );
    const openings = lines.map(whyOpeningFingerprint);
    assert.equal(
      new Set(openings).size,
      3,
      `openings should differ: ${openings.join(" | ")} — lines: ${lines.join(" || ")}`,
    );
    assert.equal(new Set(lines).size, 3);
    for (const line of lines) {
      assertVisualWhy(line, "mild");
      assert.doesNotMatch(line, JARGON);
    }
  });
});

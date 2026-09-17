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
  /value contrast|different values|second story|loud break|texture break|as the ground|frames a softer|sharper outer|softer body|\w+ against [\w ]+ is (?:the |a )?(?:value |texture )?(?:contrast|break)|firmer face|easier hang|keep the stack|upper stack|\bstac(?:k|ked)\b|dark weight/i;

const STRUCTURE_BANS =
  /cotton outside|linen inside|keep the stack|firmer face|easier hang underneath|firmer face,? easier|dark weight|\bstac(?:k|ked)\b/i;

function assertVisualWhy(text: string, climate: Climate = "mild") {
  const bits = sentences(text);
  assert.equal(bits.length, 2, `"${text}" should be two sentences`);
  const n = text.trim().split(/\s+/).length;
  assert.ok(n >= 18 && n <= 50, `"${text}" is ${n} words`);
  assert.doesNotMatch(text, /psychologically|trustworthy person|you are/i);
  assert.doesNotMatch(text, /wet-weather|even on a mild day|weather-ready/i);
  assert.doesNotMatch(text, JARGON);
  assert.doesNotMatch(text, STRUCTURE_BANS);
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
  it("navy/ivory/olive: names garments, no jargon shell, no fiber-as-insight", () => {
    const text = richWhy(navyIvoryOlive, "school", "mild", "texture");
    assertVisualWhy(text, "mild");
    assert.match(text, /ivory/i);
    assert.match(text, /navy/i);
    assert.match(text, /olive/i);
    assert.match(text, /shirt|jacket|chinos/i);
    assert.match(text, /chinos/i);
    // Prefer visual structure over naming demo fiber fields as the insight.
    assert.doesNotMatch(text, /\b(cotton|linen)\b/i);
    assert.match(text, /structure|softly|crisper|smoother|drape|cleaner/i);
    assert.doesNotMatch(text, /navy harrington|ivory linen shirt/i);
    assert.doesNotMatch(text, /harrington over/i);
    assert.doesNotMatch(text, JARGON);
  });

  it("harrington/ivory/olive: spatial palette + clear structure (no quality drop)", () => {
    const tonal = richWhy(navyIvoryOlive, "school", "mild", "tonal");
    const silhouette = richWhy(navyIvoryOlive, "school", "mild", "silhouette");
    assertVisualWhy(tonal, "mild");
    assertVisualWhy(silhouette, "mild");

    // First sentence keeps top → middle → bottom color roles (tonal or silhouette).
    assert.match(tonal, /harrington|jacket/i);
    assert.match(tonal, /shirt/i);
    assert.match(tonal, /chinos|lower half/i);
    assert.match(
      silhouette,
      /darker tone sits in the (?:harrington|jacket).*lightens the middle.*lower half/i,
    );

    // Second sentence: observable garment relationship, not fiber/stack metaphor.
    assert.match(
      tonal,
      /(?:harrington|jacket) adds structure.*shirt beneath falls more softly/i,
    );
    assert.doesNotMatch(tonal, /\bblazer\b/i);
    assert.doesNotMatch(silhouette, /\bblazer\b/i);
    assert.doesNotMatch(tonal, STRUCTURE_BANS);
    assert.doesNotMatch(tonal, /\b(cotton|linen)\b/i);
    assert.doesNotMatch(silhouette, STRUCTURE_BANS);
    assert.doesNotMatch(silhouette, /dark weight/i);

    for (const insight of [
      "tonal",
      "accent",
      "texture",
      "silhouette",
    ] as WhyInsight[]) {
      const text = richWhy(navyIvoryOlive, "school", "mild", insight);
      assertVisualWhy(text, "mild");
      assert.doesNotMatch(text, STRUCTURE_BANS);
      assert.doesNotMatch(text, /navy harrington|ivory linen shirt/i);
    }
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

  it("denim + merino seed notes: never blazer or coat", () => {
    const pieces = [
      g({
        id: "g_denim_jacket",
        name: "Indigo denim jacket",
        category: "outerwear",
        colorName: "Indigo",
        hex: "#2c3a6a",
        material: "Denim",
        notes: "Campus layer. Not a blazer.",
      }),
      g({
        id: "g_black_merino",
        name: "Black merino crew",
        category: "tops",
        colorName: "Black",
        hex: "#1a1a1a",
        material: "Merino",
        notes: "Fine gauge. Works under a coat or alone.",
      }),
      g({
        id: "g_black_jean",
        name: "Black jeans",
        category: "bottoms",
        colorName: "Black",
        hex: "#1a1a1a",
        material: "Denim",
      }),
    ];
    for (const insight of [
      "tonal",
      "accent",
      "texture",
      "silhouette",
    ] as WhyInsight[]) {
      const text = richWhy(pieces, "school", "mild", insight);
      assertVisualWhy(text, "mild");
      assert.doesNotMatch(text, /\bblazer\b/i);
      assert.doesNotMatch(text, /\bcoat\b/i);
      assert.match(text, /jacket|crew|knit|jeans/i);
      assert.doesNotMatch(text, /different values|second story/i);
    }
  });

  it("harrington seed notes: never blazer", () => {
    const pieces = [
      g({
        id: "g_navy_harrington",
        name: "Navy harrington",
        category: "outerwear",
        colorName: "Navy",
        hex: "#1c2a4a",
        material: "Cotton",
        notes: "Campus jacket, not a blazer.",
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
    ];
    for (const insight of [
      "tonal",
      "accent",
      "texture",
      "silhouette",
    ] as WhyInsight[]) {
      const text = richWhy(pieces, "school", "mild", insight);
      assertVisualWhy(text, "mild");
      assert.doesNotMatch(text, /\bblazer\b/i);
      assert.match(text, /harrington|jacket|shirt|chinos/i);
      // Why copy: shirt role, not linen fiber name-dropping.
      assert.doesNotMatch(text, /\blinen\b/i);
    }
  });

  it("shell + tee accent line is grammatical; no second story / different values", () => {
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
        id: "g_tee",
        name: "Heather grey tee",
        category: "tops",
        colorName: "Grey",
        hex: "#8a8a8a",
        material: "Cotton",
      }),
      g({
        id: "g_jean",
        name: "Dark indigo jeans",
        category: "bottoms",
        colorName: "Indigo",
        hex: "#2c3a6a",
        material: "Denim",
      }),
      g({
        id: "g_loafer",
        name: "Sand loafers",
        category: "footwear",
        colorName: "Sand",
        hex: "#c2a882",
      }),
    ];
    const text = richWhy(pieces, "school", "mild", "accent");
    assertVisualWhy(text, "mild");
    assert.doesNotMatch(text, /second story|different values/i);
    assert.match(
      text,
      /after the .+ shell over the .+ tee and .+ jeans below/i,
    );
    assert.doesNotMatch(text, /after navy shell over grey tee, then/i);
  });

    it("imported closet: messy names, empty material/notes, still two visual sentences", () => {
    const pieces = [
      g({
        id: "imp_zip",
        name: "old nike zip",
        category: "tops",
        colorName: "Black",
        hex: "#1a1a1a",
        formality: "athletic",
      }),
      g({
        id: "imp_tee",
        name: "white uniqlo tee",
        category: "tops",
        colorName: "White",
        hex: "#f7f7f4",
        formality: "athletic",
      }),
      g({
        id: "imp_cargo",
        name: "thrifted cargos",
        category: "bottoms",
        colorName: "Khaki",
        hex: "#9a8f6e",
        formality: "casual",
      }),
      g({
        id: "imp_dunk",
        name: "dunks",
        category: "footwear",
        colorName: "White",
        hex: "#f7f7f4",
      }),
    ];
    const text = richWhy(pieces, "gym", "mild", "accent");
    assertVisualWhy(text, "mild");
    assert.match(text, /black|white|khaki/i);
    assert.match(text, /zip|tee|cargos|sneakers/i);
    assert.doesNotMatch(text, /old nike zip/i);
    assert.doesNotMatch(text, /white uniqlo tee/i);
    assert.doesNotMatch(text, /\b(cotton|linen|wool|nylon)\b/i);
  });

  it("imported closet: Custom hex refines to navy; junk name does not leak", () => {
    const pieces = [
      g({
        id: "imp_j",
        name: "jacket 2",
        category: "outerwear",
        colorName: "Custom",
        hex: "#1c2a4a",
      }),
      g({
        id: "imp_s",
        name: "the shirt I wear",
        category: "tops",
        colorName: "Ivory",
        hex: "#f3eee4",
      }),
      g({
        id: "imp_p",
        name: "pants",
        category: "bottoms",
        colorName: "Olive",
        hex: "#5c6040",
      }),
    ];
    const text = richWhy(pieces, "weekend", "mild", "texture");
    assertVisualWhy(text, "mild");
    assert.match(text, /navy/i);
    assert.match(text, /ivory|olive|jacket|shirt|trousers|chinos/i);
    assert.doesNotMatch(text, /jacket 2/i);
    assert.doesNotMatch(text, /the shirt I wear/i);
  });
});

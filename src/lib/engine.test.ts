import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeLooks } from "./engine.ts";
import type { Brief, Extra, Garment } from "./types.ts";

function garment(
  partial: Pick<Garment, "id" | "name" | "category" | "colorName" | "hex"> &
    Partial<Garment>,
): Garment {
  return {
    brand: "",
    material: "Cotton",
    formality: "casual",
    seasons: ["all"],
    climate: ["mild", "cool", "warm"],
    notes: "",
    tags: ["School", "Weekend"],
    createdAt: 0,
    ...partial,
  };
}

function fragrance(id: string, family: Extra["family"], climate: Extra["climate"]): Extra {
  return {
    id,
    name: id,
    brand: "Test",
    kind: "fragrance",
    notes: "",
    climate,
    formality: ["casual", "smart-casual"],
    tags: [],
    family,
    createdAt: 0,
  };
}

const closet: Garment[] = [
  garment({
    id: "top_tee",
    name: "Grey tee",
    category: "tops",
    colorName: "Grey",
    hex: "#8a8a8a",
    tags: ["School", "Weekend", "Gym"],
  }),
  garment({
    id: "top_oxford",
    name: "White oxford",
    category: "tops",
    colorName: "White",
    hex: "#f5f5f5",
    formality: "business",
    tags: ["Work"],
  }),
  garment({
    id: "bottom_jean",
    name: "Indigo jean",
    category: "bottoms",
    colorName: "Indigo",
    hex: "#2c3a5a",
  }),
  garment({
    id: "bottom_short",
    name: "Sand short",
    category: "bottoms",
    colorName: "Sand",
    hex: "#cbb89a",
    climate: ["hot", "warm"],
  }),
  garment({
    id: "outer_denim",
    name: "Denim jacket",
    category: "outerwear",
    colorName: "Indigo",
    hex: "#3a4a6a",
    climate: ["mild", "cool"],
    notes: "Campus denim jacket.",
  }),
  garment({
    id: "outer_coat",
    name: "Navy wool overcoat",
    category: "outerwear",
    colorName: "Navy",
    hex: "#1c2a4a",
    formality: "business",
    climate: ["cool", "cold"],
    notes: "Knee length coat.",
  }),
  garment({
    id: "outer_shell",
    name: "Rain shell",
    category: "outerwear",
    colorName: "Black",
    hex: "#1a1a1a",
    climate: ["rain", "cool"],
  }),
  garment({
    id: "shoe_sneaker",
    name: "White sneaker",
    category: "footwear",
    colorName: "White",
    hex: "#f0f0f0",
    tags: ["School", "Weekend", "Gym"],
  }),
  garment({
    id: "shoe_oxford",
    name: "Black oxford shoe",
    category: "footwear",
    colorName: "Black",
    hex: "#111111",
    formality: "business",
    tags: ["Work"],
  }),
  garment({
    id: "acc_watch",
    name: "Steel watch",
    category: "accessories",
    colorName: "Steel",
    hex: "#9aa0a6",
  }),
  garment({
    id: "acc_umbrella",
    name: "Black umbrella",
    category: "accessories",
    colorName: "Black",
    hex: "#101010",
    climate: ["rain", "cool"],
  }),
  garment({
    id: "bag_tote",
    name: "Black tote",
    category: "bags",
    colorName: "Black",
    hex: "#1a1a1a",
    tags: ["School", "Work"],
  }),
  garment({
    id: "gym_tee",
    name: "Gym tee",
    category: "tops",
    colorName: "Black",
    hex: "#222222",
    formality: "athletic",
    tags: ["Gym"],
  }),
  garment({
    id: "gym_jogger",
    name: "Gym jogger",
    category: "bottoms",
    colorName: "Black",
    hex: "#2a2a2a",
    formality: "athletic",
    tags: ["Gym"],
  }),
  garment({
    id: "gym_hoodie",
    name: "Black hoodie",
    category: "tops",
    colorName: "Black",
    hex: "#1c1c1c",
    formality: "athletic",
    tags: ["Gym"],
    notes: "Soft fleece hoodie for cool gym days.",
  }),
  garment({
    id: "gym_trainer",
    name: "Gym trainer",
    category: "footwear",
    colorName: "White",
    hex: "#eeeeee",
    formality: "athletic",
    tags: ["Gym"],
  }),
];

const extras: Extra[] = [
  fragrance("e_citrus", "citrus", ["hot", "warm", "mild"]),
  fragrance("e_woody", "woody", ["cool", "cold", "mild"]),
  {
    id: "e_cleanser",
    name: "Cleanser",
    brand: "Test",
    kind: "skincare",
    notes: "",
    climate: ["mild"],
    formality: ["casual"],
    tags: [],
    slot: "am",
    step: 1,
    createdAt: 0,
  },
];

function brief(partial: Partial<Brief> & Pick<Brief, "description">): Brief {
  return {
    climate: "mild",
    occasion: "casual",
    season: "fall",
    ...partial,
  };
}

describe("composeLooks", () => {
  it("returns up to three wearable looks for a school brief", () => {
    const looks = composeLooks(
      closet,
      extras,
      brief({
        description: "School and hallway, keep it easy",
        occasion: "casual",
        climate: "cool",
      }),
    );
    assert.ok(looks.length >= 1 && looks.length <= 3);
    for (const look of looks) {
      assert.equal(look.source, "engine");
      assert.ok(look.garmentIds.length >= 2);
      const pieces = look.garmentIds.map(
        (id) => closet.find((g) => g.id === id)!,
      );
      const hasBody =
        pieces.some((p) => p.category === "dresses") ||
        (pieces.some((p) => p.category === "tops") &&
          pieces.some((p) => p.category === "bottoms"));
      assert.ok(hasBody, `look ${look.name} missing body`);
      assert.ok(
        !pieces.some((p) => /short/i.test(p.name)) ||
          !pieces.some((p) => /coat/i.test(p.name)),
        "shorts must not pair with a coat",
      );
    }
  });

  it("attaches fragrance and skincare extras instead of leaving extraIds empty", () => {
    const looks = composeLooks(
      closet,
      extras,
      brief({
        description: "Weekend errands, mild day",
        climate: "warm",
        occasion: "casual",
      }),
    );
    assert.ok(looks.length >= 1);
    assert.ok(
      looks.every((l) => l.extraIds.length > 0),
      "engine should pick grooming extras",
    );
    assert.ok(
      looks.some((l) => l.extraIds.includes("e_citrus")),
      "warm brief should prefer citrus fragrance",
    );
    assert.ok(
      looks.every((l) => l.extraIds.includes("e_cleanser")),
      "day brief should include am skincare",
    );
  });

  it("prefers an umbrella on rain days", () => {
    const looks = composeLooks(
      closet,
      extras,
      brief({
        description: "School in the rain",
        climate: "rain",
        occasion: "casual",
      }),
    );
    assert.ok(looks.length >= 1);
    assert.ok(
      looks.some((l) => l.garmentIds.includes("acc_umbrella")),
      "rain looks should include the umbrella",
    );
  });

  it("keeps gym looks athletic and skips campus jackets", () => {
    const looks = composeLooks(
      closet,
      extras,
      brief({
        description: "Gym PE workout",
        climate: "mild",
        occasion: "athletic",
      }),
    );
    assert.ok(looks.length >= 1);
    for (const look of looks) {
      const pieces = look.garmentIds.map(
        (id) => closet.find((g) => g.id === id)!,
      );
      assert.ok(
        pieces.every(
          (p) =>
            p.formality === "athletic" ||
            (p.tags ?? []).some((t) => t.toLowerCase() === "gym") ||
            /hoodie/i.test(p.name),
        ),
        `non-athletic piece in gym look: ${look.garmentIds.join(",")}`,
      );
      assert.ok(
        !pieces.some((p) => /denim jacket|harrington|rain shell/i.test(p.name)),
        "campus outerwear must stay out of gym looks",
      );
    }
  });

  it("adds a gym layer when the gym brief is cool", () => {
    const looks = composeLooks(
      closet,
      extras,
      brief({
        description: "Gym workout",
        climate: "cool",
        occasion: "athletic",
      }),
    );
    assert.ok(looks.length >= 1);
    assert.ok(
      looks.some((l) => l.garmentIds.includes("gym_hoodie")),
      "cool gym should pull a hoodie layer",
    );
  });

  it("does not score the palette twice (score stays stable across calls)", () => {
    const b = brief({
      description: "Quiet office day",
      climate: "cool",
      occasion: "business",
    });
    const a = composeLooks(closet, extras, b);
    const again = composeLooks(closet, extras, b);
    assert.deepEqual(
      a.map((l) => l.score),
      again.map((l) => l.score),
    );
  });
});

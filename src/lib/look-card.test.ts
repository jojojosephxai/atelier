import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lookName } from "./board-set.ts";
import { isShareCardSrc, lookCardModel, visibleGarmentSrc } from "./look-card.ts";
import type { Garment } from "./types.ts";

function piece(
  partial: Pick<Garment, "id" | "name" | "category" | "colorName">,
): Garment {
  return {
    brand: "",
    hex: "#111111",
    material: "",
    formality: "casual",
    seasons: ["all"],
    climate: ["mild", "rain"],
    notes: "",
    tags: ["School"],
    createdAt: 0,
    ...partial,
  };
}

const rain = piece({
  id: "g_rain_shell",
  name: "Navy rain shell",
  category: "outerwear",
  colorName: "Navy",
});
const tee = piece({
  id: "g_grey_tee",
  name: "Heather grey tee",
  category: "tops",
  colorName: "Grey",
});
const jeans = piece({
  id: "g_indigo_jean",
  name: "Indigo jeans",
  category: "bottoms",
  colorName: "Indigo",
});

describe("look cards stay on the kit", () => {
  it("title and garment ids are the same pieces, even if a flat-lay is attached", () => {
    const pieces = [rain, tee, jeans];
    const model = lookCardModel(
      pieces,
      "school",
      "/og.jpg",
    );
    assert.equal(model.title, lookName(pieces, "school"));
    assert.equal(model.title, "Rain shell + Heather grey tee");
    assert.deepEqual(model.garmentIds, [
      "g_rain_shell",
      "g_grey_tee",
      "g_indigo_jean",
    ]);
    assert.equal(JSON.stringify(model).includes("og.jpg"), false);
  });

  it("does not treat the share card as a garment photo", () => {
    assert.equal(isShareCardSrc("/og.jpg"), true);
    assert.equal(isShareCardSrc("https://atelier.example/og.jpg?v=1"), true);
    assert.equal(isShareCardSrc("/sample/cut/rain-shell.webp?v55"), false);
    assert.equal(visibleGarmentSrc("/og.jpg"), undefined);
    assert.equal(
      visibleGarmentSrc("/sample/cut/rain-shell.webp?v55"),
      "/sample/cut/rain-shell.webp?v55",
    );
  });
});

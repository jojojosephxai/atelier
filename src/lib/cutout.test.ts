import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frameCutBounds, hardenMatte, refineMatte, trimSubjectView } from "./cutout.ts";

function makeImageData(
  w: number,
  h: number,
  fill: (x: number, y: number, px: Uint8ClampedArray, i: number) => void,
): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      fill(x, y, data, (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
}

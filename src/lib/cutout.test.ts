import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refineMatte } from "./cutout.ts";

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

describe("refineMatte", () => {
  it("kills soft halo alpha and solidifies the subject", () => {
    const img = makeImageData(12, 12, (x, y, px, i) => {
      // Solid red square in the middle
      if (x >= 3 && x <= 8 && y >= 3 && y <= 8) {
        px[i] = 180;
        px[i + 1] = 40;
        px[i + 2] = 40;
        px[i + 3] = 255;
        return;
      }
      // Soft white fringe around it
      if (x >= 2 && x <= 9 && y >= 2 && y <= 9) {
        px[i] = 245;
        px[i + 1] = 245;
        px[i + 2] = 245;
        px[i + 3] = 90;
        return;
      }
      px[i + 3] = 0;
    });

    refineMatte(img, {
      maxEdge: 1600,
      alphaKill: 72,
      alphaSolid: 220,
      edgeTrim: 1,
      stripHanger: false,
    });

    // Fringe must be gone
    const fringe = (2 * 12 + 2) * 4;
    assert.equal(img.data[fringe + 3], 0);

    // Interior must stay opaque
    const mid = (5 * 12 + 5) * 4;
    assert.equal(img.data[mid + 3], 255);
    assert.ok(img.data[mid] > 100);
  });

  it("does not leave mid-alpha pixels after product profile", () => {
    const img = makeImageData(8, 8, (x, y, px, i) => {
      if (x >= 2 && x <= 5 && y >= 2 && y <= 5) {
        px[i] = 30;
        px[i + 1] = 30;
        px[i + 2] = 30;
        px[i + 3] = x === 2 || x === 5 || y === 2 || y === 5 ? 140 : 255;
        return;
      }
      px[i + 3] = 0;
    });

    refineMatte(img, {
      maxEdge: 1600,
      alphaKill: 72,
      alphaSolid: 220,
      edgeTrim: 1,
      stripHanger: false,
    });

    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i]!;
      assert.ok(a === 0 || a === 255, `unexpected alpha ${a}`);
    }
  });
});

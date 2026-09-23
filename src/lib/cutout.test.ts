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

  it("binarizes leftover mid-alpha even when the edge is not trimmed", () => {
    const img = makeImageData(6, 6, (x, y, px, i) => {
      if (x >= 1 && x <= 4 && y >= 1 && y <= 4) {
        px[i] = 20;
        px[i + 1] = 40;
        px[i + 2] = 80;
        px[i + 3] = 230;
        return;
      }
      px[i + 3] = 0;
    });

    refineMatte(img, {
      maxEdge: 1280,
      alphaKill: 96,
      alphaSolid: 208,
      edgeTrim: 0,
      stripHanger: false,
    });

    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i]!;
      assert.ok(a === 0 || a === 255, `unexpected alpha ${a}`);
    }
    const mid = (3 * 6 + 3) * 4;
    assert.equal(img.data[mid + 3], 255);
  });

  it("keeps interior white fabric and drops a white fringe", () => {
    const img = makeImageData(9, 9, (x, y, px, i) => {
      if (x >= 2 && x <= 6 && y >= 2 && y <= 6) {
        px[i] = 248;
        px[i + 1] = 248;
        px[i + 2] = 246;
        px[i + 3] = 190;
        return;
      }
      if (x >= 1 && x <= 7 && y >= 1 && y <= 7) {
        px[i] = 250;
        px[i + 1] = 250;
        px[i + 2] = 250;
        px[i + 3] = 70;
        return;
      }
      px[i + 3] = 0;
    });

    refineMatte(img, {
      maxEdge: 1280,
      alphaKill: 96,
      alphaSolid: 208,
      edgeTrim: 1,
      stripHanger: false,
    });

    const fringe = (1 * 9 + 1) * 4;
    assert.equal(img.data[fringe + 3], 0);
    const mid = (4 * 9 + 4) * 4;
    assert.equal(img.data[mid + 3], 255);
    assert.ok(img.data[mid]! > 200);
  });

  it("does not chew an opaque label inside a bottle", () => {
    const img = makeImageData(16, 16, (x, y, px, i) => {
      const inBottle = x >= 3 && x <= 12 && y >= 2 && y <= 13;
      const onLabel = x >= 5 && x <= 10 && y >= 6 && y <= 9;
      if (onLabel) {
        px[i] = 250;
        px[i + 1] = 250;
        px[i + 2] = 250;
        px[i + 3] = 255;
        return;
      }
      if (inBottle) {
        px[i] = 30;
        px[i + 1] = 70;
        px[i + 2] = 90;
        px[i + 3] = 255;
        return;
      }
      if (x >= 2 && x <= 13 && y >= 1 && y <= 14) {
        px[i] = 245;
        px[i + 1] = 245;
        px[i + 2] = 245;
        px[i + 3] = 80;
        return;
      }
      px[i + 3] = 0;
    });

    refineMatte(img, {
      maxEdge: 1600,
      alphaKill: 96,
      alphaSolid: 208,
      edgeTrim: 0,
      stripHanger: false,
    });

    const label = (7 * 16 + 7) * 4;
    assert.equal(img.data[label + 3], 255);
    assert.ok(img.data[label]! > 230);
    assert.ok(img.data[label + 1]! > 230);
    const halo = (1 * 16 + 4) * 4;
    assert.equal(img.data[halo + 3], 0);
  });
});

describe("hardenMatte", () => {
  it("clears a soft garment fringe and keeps the shirt", () => {
    const img = makeImageData(10, 10, (x, y, px, i) => {
      if (x >= 3 && x <= 7 && y >= 3 && y <= 7) {
        px[i] = 40;
        px[i + 1] = 70;
        px[i + 2] = 110;
        px[i + 3] = 255;
        return;
      }
      if (x >= 2 && x <= 8 && y >= 2 && y <= 8) {
        px[i] = 230;
        px[i + 1] = 230;
        px[i + 2] = 230;
        px[i + 3] = 100;
        return;
      }
      px[i + 3] = 0;
    });
    hardenMatte(img, "garment");
    assert.equal(img.data[(2 * 10 + 2) * 4 + 3], 0);
    assert.equal(img.data[(5 * 10 + 5) * 4 + 3], 255);
    assert.ok(img.data[(5 * 10 + 5) * 4]! < 80);
  });
});

describe("frameCutBounds", () => {
  it("pads the subject and keeps it inside the bitmap", () => {
    const box = frameCutBounds(100, 80, { x0: 10, y0: 8, x1: 50, y1: 40 });
    assert.ok(box.x0 < 10);
    assert.ok(box.y0 < 8);
    assert.ok(box.x1 > 51);
    assert.ok(box.y1 > 41);
    assert.ok(box.x0 >= 0 && box.y0 >= 0);
    assert.ok(box.x1 <= 100 && box.y1 <= 80);
    assert.ok(box.x1 - box.x0 > 50 - 10);
  });

  it("does not shift a subject that already touches the edge", () => {
    const box = frameCutBounds(40, 40, { x0: 0, y0: 0, x1: 39, y1: 39 });
    assert.equal(box.x0, 0);
    assert.equal(box.y0, 0);
    assert.equal(box.x1, 40);
    assert.equal(box.y1, 40);
  });
});

describe("trimSubjectView", () => {
  it("zooms a loose cutout in toward the subject", () => {
    const box = trimSubjectView(200, 200, { x0: 70, y0: 60, x1: 120, y1: 130 });
    assert.ok(box);
    assert.ok(box.w < 200);
    assert.ok(box.h < 200);
    assert.ok(box.x < 70);
    assert.ok(box.x + box.w > 121);
  });

  it("leaves a tight cutout to the tile padding", () => {
    assert.equal(
      trimSubjectView(100, 120, { x0: 4, y0: 5, x1: 95, y1: 112 }),
      null,
    );
  });
});

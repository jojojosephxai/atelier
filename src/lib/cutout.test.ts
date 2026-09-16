import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyCutError,
  cutFailCopy,
  dropFloorHalo,
  refineMatte,
  stripHanger,
  tileBlobAfterCut,
  type CutProfile,
} from "./cutout.ts";

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

const BASE_PRODUCT: CutProfile = {
  maxEdge: 1600,
  alphaKill: 72,
  alphaSolid: 220,
  edgeTrim: 1,
  stripHanger: false,
};

const GARMENT_HALO: CutProfile = {
  maxEdge: 1280,
  alphaKill: 64,
  alphaSolid: 200,
  edgeTrim: 1,
  stripHanger: true,
  haloTrim: true,
  protectLabels: false,
};

const PRODUCT_LABEL: CutProfile = {
  maxEdge: 1600,
  alphaKill: 80,
  alphaSolid: 220,
  edgeTrim: 1,
  stripHanger: false,
  haloTrim: false,
  protectLabels: true,
};

function pxAt(img: ImageData, x: number, y: number) {
  const i = (y * img.width + x) * 4;
  return {
    r: img.data[i]!,
    g: img.data[i + 1]!,
    b: img.data[i + 2]!,
    a: img.data[i + 3]!,
  };
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

    refineMatte(img, BASE_PRODUCT);

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

    refineMatte(img, BASE_PRODUCT);

    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i]!;
      assert.ok(a === 0 || a === 255, `unexpected alpha ${a}`);
    }
  });
});

describe("floor halo", () => {
  it("drops beige floor fringe that would otherwise solidify around a garment", () => {
    const img = makeImageData(16, 16, (x, y, px, i) => {
      if (x >= 5 && x <= 10 && y >= 5 && y <= 10) {
        px[i] = 36;
        px[i + 1] = 48;
        px[i + 2] = 110;
        px[i + 3] = 255;
        return;
      }
      if (x >= 3 && x <= 12 && y >= 3 && y <= 12) {
        px[i] = 210;
        px[i + 1] = 198;
        px[i + 2] = 176;
        px[i + 3] = 120;
        return;
      }
      px[i + 3] = 0;
    });

    const without = makeImageData(16, 16, (x, y, px, i) => {
      const src = (y * 16 + x) * 4;
      px[i] = img.data[src]!;
      px[i + 1] = img.data[src + 1]!;
      px[i + 2] = img.data[src + 2]!;
      px[i + 3] = img.data[src + 3]!;
    });

    refineMatte(without, { ...GARMENT_HALO, haloTrim: false });
    assert.equal(
      pxAt(without, 4, 8).a,
      255,
      "control: mid-alpha floor would stay",
    );

    dropFloorHalo(img, GARMENT_HALO);
    refineMatte(img, GARMENT_HALO);

    assert.equal(pxAt(img, 4, 8).a, 0);
    assert.equal(pxAt(img, 11, 8).a, 0);
    assert.equal(pxAt(img, 7, 7).a, 255);
    assert.ok(pxAt(img, 7, 7).b > 80);
  });
});

describe("hanger", () => {
  it("removes the hook and bar and keeps the garment body", () => {
    const w = 48;
    const h = 80;
    const img = makeImageData(w, h, (x, y, px, i) => {
      const hook = y <= 10 && x >= 23 && x <= 25;
      const bar = y >= 11 && y <= 14 && x >= 8 && x <= 40;
      const body = y >= 18 && y <= 76 && x >= 6 && x <= 41;
      if (hook || bar) {
        px[i] = 176;
        px[i + 1] = 176;
        px[i + 2] = 182;
        px[i + 3] = 255;
        return;
      }
      if (body) {
        px[i] = 28;
        px[i + 1] = 40;
        px[i + 2] = 92;
        px[i + 3] = 255;
        return;
      }
      px[i + 3] = 0;
    });

    stripHanger(img);

    assert.equal(pxAt(img, 24, 4).a, 0, "hook");
    assert.equal(pxAt(img, 24, 12).a, 0, "bar");
    assert.equal(pxAt(img, 24, 40).a, 255, "body");
    assert.ok(pxAt(img, 24, 40).b > 60);
  });
});

describe("product label", () => {
  it("keeps hard-edged label paper and ink on a bottle", () => {
    const img = makeImageData(24, 24, (x, y, px, i) => {
      const bottle = x >= 6 && x <= 17 && y >= 4 && y <= 20;
      const label = x >= 10 && x <= 17 && y >= 8 && y <= 16;
      const ink = x >= 12 && x <= 15 && y >= 10 && y <= 14;
      if (ink) {
        px[i] = 22;
        px[i + 1] = 18;
        px[i + 2] = 16;
        px[i + 3] = 255;
        return;
      }
      if (label) {
        px[i] = 248;
        px[i + 1] = 246;
        px[i + 2] = 240;
        px[i + 3] = 255;
        return;
      }
      if (bottle) {
        px[i] = 18;
        px[i + 1] = 72;
        px[i + 2] = 48;
        px[i + 3] = 255;
        return;
      }
      if (x >= 4 && x <= 19 && y >= 2 && y <= 22) {
        px[i] = 240;
        px[i + 1] = 238;
        px[i + 2] = 232;
        px[i + 3] = 90;
        return;
      }
      px[i + 3] = 0;
    });

    refineMatte(img, PRODUCT_LABEL);

    const paper = pxAt(img, 11, 9);
    const text = pxAt(img, 13, 12);
    const glass = pxAt(img, 7, 12);
    const halo = pxAt(img, 4, 4);

    assert.equal(paper.a, 255);
    assert.ok(paper.r > 200, `label paper chewed to ${paper.r}`);
    assert.equal(text.a, 255);
    assert.ok(text.r < 80, `label ink chewed to ${text.r}`);
    assert.equal(glass.a, 255);
    assert.equal(halo.a, 0);

    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i]!;
      assert.ok(a === 0 || a === 255, `unexpected alpha ${a}`);
    }
  });
});

describe("failed cut still keeps a photo", () => {
  it("returns the original when the cut is missing, empty, or tiny", () => {
    const original = new Blob([new Uint8Array(200)], { type: "image/jpeg" });
    assert.equal(tileBlobAfterCut(original, null), original);
    assert.equal(tileBlobAfterCut(original, undefined), original);
    assert.equal(
      tileBlobAfterCut(original, new Blob([], { type: "image/png" })),
      original,
    );
    assert.equal(
      tileBlobAfterCut(original, new Blob([new Uint8Array(8)], { type: "image/png" })),
      original,
    );
  });

  it("returns the isolated cut when it is large enough", () => {
    const original = new Blob([new Uint8Array(200)], { type: "image/jpeg" });
    const cut = new Blob([new Uint8Array(256)], { type: "image/png" });
    assert.equal(tileBlobAfterCut(original, cut), cut);
  });

  it("explains limit, timeout, and fail in plain language", () => {
    assert.match(cutFailCopy("limit"), /original photo/i);
    assert.match(cutFailCopy("timeout"), /original photo/i);
    assert.match(cutFailCopy("fail"), /original photo/i);
    assert.equal(classifyCutError(new Error("Cut limit reached for today")), "limit");
    assert.equal(
      classifyCutError(new DOMException("Cut timed out", "AbortError")),
      "timeout",
    );
    assert.equal(classifyCutError(new Error("No garment in the cut")), "fail");
  });
});

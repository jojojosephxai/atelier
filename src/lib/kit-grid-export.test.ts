import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseDelivery, containBox, kitExportFilename } from "./kit-grid-export.ts";

describe("containBox", () => {
  it("letterboxes a wide garment inside the tile", () => {
    const box = containBox({ x: 10, y: 20, w: 100, h: 50 }, 200, 50);
    assert.ok(Math.abs(box.w - 100) < 0.01);
    assert.ok(Math.abs(box.h - 25) < 0.01);
    assert.ok(Math.abs(box.x - 10) < 0.01);
    assert.ok(Math.abs(box.y - 32.5) < 0.01);
  });

  it("fills a square tile with a square garment", () => {
    const box = containBox({ x: 0, y: 0, w: 80, h: 80 }, 400, 400);
    assert.deepEqual(box, { x: 0, y: 0, w: 80, h: 80 });
  });
});

describe("kitExportFilename", () => {
  it("slugs the look name into a png filename", () => {
    assert.equal(kitExportFilename("Navy & stone"), "atelier-kit-navy-stone.png");
  });

  it("falls back when the name has no letters", () => {
    assert.equal(kitExportFilename("!!!"), "atelier-kit-look.png");
  });
});

describe("chooseDelivery", () => {
  it("uses the share sheet only when the browser can share files", () => {
    assert.equal(chooseDelivery(true), "share");
    assert.equal(chooseDelivery(false), "download");
  });
});

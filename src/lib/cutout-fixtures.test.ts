import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { hardenMatte } from "./cutout.ts";

/**
 * Small photos of the shipped cutouts. `npm test` checks them so a cutout
 * change cannot bring back fragrance text bars or the indigo-jeans peel
 * (speckles, white waist fill, soft halo) without a failing test.
 *
 * Each PNG is a 96px-wide area-average of the public sample it names.
 * Thresholds sit between these clean tiles and the JOS-30 overlays:
 * Tonka top-band ink 0.179, Claymation black-bar fraction 0.047,
 * Santal 33 top-band ink 0.288 and black-bar fraction 0.078.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const STUDIO_R = 247;
const STUDIO_G = 242;
const STUDIO_B = 232;

type Rgba = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type BottleFixture = {
  name: string;
  png: string;
  source: string;
  sha256: string;
  subject: readonly [number, number];
};

type JeansFixture = {
  name: string;
  png: string;
  source: string;
  sha256: string;
};

const BOTTLES: readonly BottleFixture[] = [
  {
    name: "Colonia",
    png: "colonia.png",
    source: "public/sample/cut/colonia.webp",
    sha256: "795b998f07b8dec949af0d30d2f01c9a27c745ec87979da937b5f740201344ad",
    subject: [0.07, 0.16],
  },
  {
    name: "Grey Flannel",
    png: "grey-flannel.png",
    source: "public/sample/cut/grey-flannel.webp",
    sha256: "61e159f783bd824b54541ee946497a8cca486800626e1fbb366da0e845a10e24",
    subject: [0.16, 0.32],
  },
  {
    name: "Tonka",
    png: "tonka.png",
    source: "public/sample/cut/tonka.webp",
    sha256: "2501b2c97336c057fa90f3d7f2f45e9690de876007a2c2a9eee79e9cdb0b00e7",
    subject: [0.12, 0.24],
  },
  {
    name: "Claymation",
    png: "hanz-clay.png",
    source: "public/sample/cut/hanz-clay.webp",
    sha256: "2d1abdb8df33b23e1a8768dafae5818ca70dfc5e023c4a717e61661172f8289a",
    subject: [0.15, 0.32],
  },
  {
    name: "Santal 33",
    png: "santal-33.png",
    source: "public/sample/cut/santal-33.webp",
    sha256: "b156aca705087f5f00bd06849e9fa473e4e7bc0393a3c098bca527e0eb858f5d",
    subject: [0.2, 0.36],
  },
];

const JEANS: JeansFixture = {
  name: "Dark indigo jeans",
  png: "indigo-jean.png",
  source: "public/sample/cut/indigo-jean.webp",
  sha256: "5e0928589572d0950f54153e979ade40ee03f5e72061065fb140218f755f44f5",
};

const TOP_INK_MAX = 0.13;
const BLACK_BAR_MAX = 0.02;

function decodePng(buf: Buffer): Rgba {
  if (buf.length < 8 || buf[0] !== 137 || buf[1] !== 80) {
    throw new Error("fixture is not a png");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    offset += 4;
    const type = buf.toString("ascii", offset, offset + 4);
    offset += 4;
    const data = buf.subarray(offset, offset + length);
    offset += length;
    offset += 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported png ${width}x${height} color ${colorType}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);
  let i = 0;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[i++] ?? 0;
    const row = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (row[x - channels] ?? 0) : 0;
      const up = prev[x] ?? 0;
      const upLeft = x >= channels ? (prev[x - channels] ?? 0) : 0;
      const value = raw[i++] ?? 0;
      row[x] = unfilter(filter, value, left, up, upLeft);
    }
    prev = row;
    for (let x = 0; x < width; x++) {
      const dest = (y * width + x) * 4;
      const src = x * channels;
      out[dest] = row[src] ?? 0;
      out[dest + 1] = row[src + 1] ?? 0;
      out[dest + 2] = row[src + 2] ?? 0;
      out[dest + 3] = channels === 4 ? (row[src + 3] ?? 0) : 255;
    }
  }
  return { width, height, data: out };
}

function unfilter(filter: number, value: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return value;
    case 1:
      return (value + left) & 255;
    case 2:
      return (value + up) & 255;
    case 3:
      return (value + ((left + up) >> 1)) & 255;
    case 4: {
      const estimate = left + up - upLeft;
      const dl = Math.abs(estimate - left);
      const du = Math.abs(estimate - up);
      const dul = Math.abs(estimate - upLeft);
      const pick = dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      return (value + pick) & 255;
    }
    default: {
      throw new Error(`png filter ${filter}`);
    }
  }
}

function loadFixture(name: string): Rgba {
  return decodePng(readFileSync(join(HERE, "cutout-fixtures", name)));
}

function asImageData(img: Rgba): ImageData {
  return img as ImageData;
}

function clone(img: Rgba): Rgba {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  };
}

function isStudioPlate(r: number, g: number, b: number): boolean {
  return (
    Math.abs(r - STUDIO_R) < 18 &&
    Math.abs(g - STUDIO_G) < 18 &&
    Math.abs(b - STUDIO_B) < 20 &&
    Math.max(r, g, b) - Math.min(r, g, b) < 30
  );
}

type CutStats = {
  topInk: number;
  blackBar: number;
  subject: number;
  opaque: number;
  soft: number;
  whiteOpaque: number;
  waistClear: number;
};

function cutStats(img: Rgba): CutStats {
  const { width, height, data } = img;
  const topH = Math.max(1, Math.floor(height * 0.22));
  let topInk = 0;
  let subject = 0;
  let opaque = 0;
  let soft = 0;
  let whiteOpaque = 0;
  let blackRows = 0;
  for (let y = 0; y < height; y++) {
    let run = 0;
    let maxRun = 0;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const r = data[o] ?? 0;
      const g = data[o + 1] ?? 0;
      const b = data[o + 2] ?? 0;
      const a = data[o + 3] ?? 0;
      const plate = isStudioPlate(r, g, b);
      if (a > 20 && !plate) {
        subject++;
        if (y < topH) topInk++;
      }
      if (a >= 240) opaque++;
      else if (a >= 16) soft++;
      if (a > 200 && r > 210 && g > 210 && b > 210) whiteOpaque++;
      if (a > 200 && r < 16 && g < 16 && b < 16) run++;
      else {
        if (run > maxRun) maxRun = run;
        run = 0;
      }
    }
    if (run > maxRun) maxRun = run;
    if (maxRun > width * 0.16) blackRows++;
  }
  const pixels = width * height;
  return {
    topInk: topInk / (topH * width),
    blackBar: blackRows / height,
    subject: subject / pixels,
    opaque: opaque / pixels,
    soft: soft / pixels,
    whiteOpaque,
    waistClear: waistClear(img),
  };
}

/** Open matte through the jeans waist. A filled waist reads as white cloth. */
function waistClear(img: Rgba): number {
  const { width, height, data } = img;
  const y0 = Math.floor(height * 0.32);
  const y1 = Math.floor(height * 0.48);
  const x0 = Math.floor(width * 0.4);
  const x1 = Math.floor(width * 0.58);
  let clear = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total++;
      if ((data[(y * width + x) * 4 + 3] ?? 0) < 20) clear++;
    }
  }
  return total === 0 ? 0 : clear / total;
}

function paint(
  img: Rgba,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: readonly [number, number, number, number],
): void {
  const { width, data } = img;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * 4;
      data[o] = rgba[0];
      data[o + 1] = rgba[1];
      data[o + 2] = rgba[2];
      data[o + 3] = rgba[3];
    }
  }
}

function assertSourceHash(source: string, sha256: string): void {
  const bytes = readFileSync(join(ROOT, source));
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, sha256, `${source} bytes changed — refresh the cutout fixture with it`);
}

function assertNoTextBars(name: string, stats: CutStats): void {
  assert.ok(
    stats.topInk <= TOP_INK_MAX,
    `${name} top-band ink ${stats.topInk.toFixed(3)} (composited label above the pack)`,
  );
  assert.ok(
    stats.blackBar <= BLACK_BAR_MAX,
    `${name} black-bar fraction ${stats.blackBar.toFixed(3)} (flat bar stamped on the pack)`,
  );
}

function assertBottle(fixture: BottleFixture, img: Rgba): void {
  assert.equal(img.width, 96);
  assert.equal(img.height, 128);
  const corner = img.data;
  assert.ok(
    Math.abs((corner[0] ?? 0) - STUDIO_R) < 4,
    `${fixture.name} corner is not the studio plate`,
  );
  const stats = cutStats(img);
  assertNoTextBars(fixture.name, stats);
  assert.ok(
    stats.subject >= fixture.subject[0] && stats.subject <= fixture.subject[1],
    `${fixture.name} subject coverage ${stats.subject.toFixed(3)} outside ${fixture.subject[0]}–${fixture.subject[1]}`,
  );
  assert.equal(stats.opaque, 1, `${fixture.name} plate is missing pixels`);
  assert.equal(stats.soft, 0, `${fixture.name} has a soft fringe`);
  const hardened = clone(img);
  hardenMatte(asImageData(hardened), "product");
  const after = cutStats(hardened);
  assert.equal(after.opaque, 1, `${fixture.name} product matte punched a hole in the pack`);
  assert.equal(after.soft, 0, `${fixture.name} product matte left a halo`);
  assertNoTextBars(fixture.name, after);
  assert.ok(
    Math.abs(after.subject - stats.subject) < 0.01,
    `${fixture.name} product matte changed the pack coverage`,
  );
}

function assertJeans(img: Rgba): void {
  assert.equal(img.width, 96);
  assert.ok(img.height > 200);
  assert.equal(img.data[3], 0, "jeans corner should be open matte");
  const before = cutStats(img);
  assert.ok(
    before.opaque > 0.6 && before.opaque < 0.75,
    `jeans coverage ${before.opaque.toFixed(3)}`,
  );
  assert.ok(before.soft < 0.06, `jeans soft edge ${before.soft.toFixed(3)}`);
  assert.equal(before.whiteOpaque, 0, "jeans already have a white halo or speckles");
  assert.ok(
    before.waistClear > 0.4,
    `jeans waist is filled (${before.waistClear.toFixed(3)} open)`,
  );
  const hardened = clone(img);
  hardenMatte(asImageData(hardened), "garment");
  const after = cutStats(hardened);
  assert.equal(after.soft, 0, "garment matte left a soft halo on the jeans");
  assert.ok(
    after.opaque > 0.6,
    `garment matte peeled the jeans down to ${after.opaque.toFixed(3)}`,
  );
  assert.ok(
    after.opaque > before.opaque - 0.03,
    `garment matte dropped jeans coverage ${before.opaque.toFixed(3)} → ${after.opaque.toFixed(3)}`,
  );
  assert.equal(after.whiteOpaque, 0, "garment matte left white speckles or a halo");
  assert.ok(
    after.waistClear > 0.4,
    `garment matte filled the waist (${after.waistClear.toFixed(3)} open)`,
  );
}

describe("cutout fixtures", () => {
  for (const fixture of BOTTLES) {
    it(`${fixture.name} stays a clean pack with no stamped text`, () => {
      assertSourceHash(fixture.source, fixture.sha256);
      assertBottle(fixture, loadFixture(fixture.png));
    });
  }

  it("indigo jeans keep coverage, a hard edge, and an open waist", () => {
    assertSourceHash(JEANS.source, JEANS.sha256);
    assertJeans(loadFixture(JEANS.png));
  });

  it("flags a composited ink block in the top band", () => {
    const img = clone(loadFixture("tonka.png"));
    const topH = Math.floor(img.height * 0.22);
    paint(img, 20, 0, 70, topH, [232, 196, 140, 255]);
    const stats = cutStats(img);
    assert.ok(stats.topInk > TOP_INK_MAX);
  });

  it("flags a flat black bar stamped across a pack", () => {
    const img = clone(loadFixture("hanz-clay.png"));
    paint(img, 8, 48, 88, 64, [0, 0, 0, 255]);
    const stats = cutStats(img);
    assert.ok(stats.blackBar > BLACK_BAR_MAX);
  });

  it("flags a white fill in the jeans waist", () => {
    const img = clone(loadFixture(JEANS.png));
    const y0 = Math.floor(img.height * 0.32);
    const y1 = Math.floor(img.height * 0.48);
    const x0 = Math.floor(img.width * 0.4);
    const x1 = Math.floor(img.width * 0.58);
    paint(img, x0, y0, x1, y1, [236, 236, 236, 255]);
    const stats = cutStats(img);
    assert.ok(stats.waistClear < 0.05);
    assert.ok(stats.whiteOpaque > 0);
  });
});

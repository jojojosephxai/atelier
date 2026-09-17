/**
 * On-device cutout pipeline.
 *
 * Stages (always, in order):
 *   1. shrinkForCut   — bound input size
 *   2. removeBackground — @imgly/background-removal
 *   3. refineMatte    — harden alpha, kill halo, defringe RGB
 *   4. keepMainSubject — drop floating debris (skipped when corners still opaque)
 *   5. stripHanger    — garment mode only
 *   6. cropIsolate    — tight crop + encode PNG
 *
 * Modes:
 *   garment — clothes on hangers / floors
 *   product — grooming bottles / jars (protect labels, harder edges)
 */

const CUT_CAP = 8;
const CUT_KEY = "atelier-cut-v2";
const cache = new Map<string, string>();
const COLD_MS = 60_000;
const WARM_MS = 30_000;

export type CutMode = "garment" | "product";

type CutProfile = {
  maxEdge: number;
  /** Mid-alpha below this becomes transparent. */
  alphaKill: number;
  /** Mid-alpha at or above this becomes solid (after kill). */
  alphaSolid: number;
  /** Erode opaque alpha by this many px before rebuild (kills fringe). */
  edgeTrim: number;
  stripHanger: boolean;
};

const PROFILES: Record<CutMode, CutProfile> = {
  garment: {
    maxEdge: 1280,
    alphaKill: 56,
    alphaSolid: 200,
    edgeTrim: 1,
    stripHanger: true,
  },
  product: {
    maxEdge: 1600,
    alphaKill: 72,
    alphaSolid: 220,
    edgeTrim: 2,
    stripHanger: false,
  },
};

let cutterWarm = false;
let preloadP: Promise<void> | null = null;

export function cutBudget(): { used: number; cap: number; ok: boolean } {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(CUT_KEY) || "null") as {
      day?: string;
      n?: number;
    } | null;
    if (!raw || raw.day !== day) return { used: 0, cap: CUT_CAP, ok: true };
    const used = Math.max(0, Number(raw.n) || 0);
    return { used, cap: CUT_CAP, ok: used < CUT_CAP };
  } catch {
    return { used: 0, cap: CUT_CAP, ok: true };
  }
}

function noteCutSuccess() {
  const day = new Date().toISOString().slice(0, 10);
  const { used } = cutBudget();
  try {
    localStorage.setItem(CUT_KEY, JSON.stringify({ day, n: used + 1 }));
  } catch {
    /* quota */
  }
}

/** Warm the on-device cutter so the first camera/library cut is not a hang. */
export function preloadCutter(): Promise<void> {
  if (!preloadP) {
    preloadP = import("@imgly/background-removal")
      .then((m) => m.preload())
      .then(() => {
        cutterWarm = true;
      })
      .catch(() => {
        preloadP = null;
      });
  }
  return preloadP;
}

function dist2(
  px: Uint8ClampedArray,
  i: number,
  br: number,
  bg: number,
  bb: number,
): number {
  const dr = px[i] - br;
  const dg = px[i + 1] - bg;
  const db = px[i + 2] - bb;
  return dr * dr + dg * dg + db * db;
}

export function needsCutout(src: string): boolean {
  if (!src) return false;
  if (src.includes("/sample/")) return false;
  if (src.startsWith("blob:")) return false;
  if (src.startsWith("data:image/png")) return false;
  return true;
}

/** Closet / garment photos. */
export async function cutGarment(
  file: File,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  keepLabel?: boolean,
): Promise<Blob> {
  // keepLabel was the old bottle flag — map it so callers that still pass it work.
  return runCut(file, keepLabel ? "product" : "garment", onProgress, signal);
}

/** Grooming bottles / jars — harder edges, labels kept. */
export async function cutProduct(
  file: File,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  return runCut(file, "product", onProgress, signal);
}

async function runCut(
  file: File,
  mode: CutMode,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const profile = PROFILES[mode];
  const budget = cutBudget();
  if (!budget.ok) throw new Error("Cut limit reached for today");
  if (signal?.aborted) throw abortErr("Aborted");

  const local = new AbortController();
  const onAbort = () => local.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => local.abort(), cutterWarm ? WARM_MS : COLD_MS);
  const died = () => {
    if (local.signal.aborted) throw abortErr("Cut timed out");
  };

  try {
    onProgress?.("Loading cutter…");
    died();
    await preloadCutter();
    died();
    const { removeBackground } = await import("@imgly/background-removal");
    died();

    onProgress?.("Preparing photo…");
    const source = await shrinkForCut(file, profile.maxEdge);
    died();

    onProgress?.("Knocking out the floor…");
    const cut = await Promise.race([
      removeBackground(source, {
        model: "isnet_fp16",
        device: "cpu",
        proxyToWorker: true,
        output: { format: "image/png", quality: 0.95 },
        progress: (_key, current, total) => {
          if (!total) return;
          onProgress?.(
            `Removing background ${Math.round((current / total) * 100)}%`,
          );
        },
      }),
      abortPromise(local.signal),
    ]);
    cutterWarm = true;
    died();

    onProgress?.("Cleaning edges…");
    await new Promise((r) => setTimeout(r, 0));
    died();
    const isolated = await Promise.race([
      finishCut(cut, profile),
      abortPromise(local.signal),
    ]);
    died();
    if (!isolated || isolated.size < 64) throw new Error("No garment in the cut");
    noteCutSuccess();
    return isolated;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function abortErr(message: string) {
  return new DOMException(message, "AbortError");
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(abortErr("Aborted"));
      return;
    }
    signal.addEventListener("abort", () => reject(abortErr("Aborted")), {
      once: true,
    });
  });
}

async function finishCut(cut: Blob, profile: CutProfile): Promise<Blob> {
  const bmp = await createImageBitmap(await ensurePng(cut));
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    throw new Error("Could not read cut");
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  refineMatte(data, profile);
  if (!cornersStillFloor(data)) {
    keepMainSubject(data);
  }
  if (profile.stripHanger) {
    stripHanger(data);
    // Second pass: hanger fill can leave soft pixels — harden again.
    refineMatte(data, {
      ...profile,
      edgeTrim: 0,
      alphaKill: Math.max(40, profile.alphaKill - 16),
    });
  }
  ctx.putImageData(data, 0, 0);
  return cropIsolate(canvas, data);
}

async function ensurePng(blob: Blob): Promise<Blob> {
  if (blob.type.includes("png")) return blob;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return blob;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return (await blobFromCanvas(canvas)) ?? blob;
}

function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 4000);
    canvas.toBlob(
      (b) => {
        clearTimeout(t);
        resolve(b);
      },
      "image/png",
    );
  });
}

async function shrinkForCut(file: File, maxEdge: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return file;
  }
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  return blob ?? file;
}

/**
 * Harden the matte so tiles never show fuzzy halos:
 * kill weak alpha, solidify the rest, trim edge fringe, defringe RGB.
 */
export function refineMatte(img: ImageData, profile: CutProfile): void {
  const px = img.data;
  const w = img.width;
  const h = img.height;
  const n = w * h;

  // 1) Soft white / gray matte → transparent (never eat solid opaque whites).
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0 || a >= 248) continue;
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (mx / 255 > 0.78 && sat < 0.12 && a < profile.alphaSolid) {
      px[i + 3] = 0;
    }
  }

  // 2) Binary-ish alpha: kill fringe, solidify subject.
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i];
    if (a === 0) continue;
    if (a < profile.alphaKill) px[i] = 0;
    else if (a < profile.alphaSolid) px[i] = 255;
  }

  // 3) Morphological edge trim — drop pixels that sit on the transparent border.
  if (profile.edgeTrim > 0) {
    const alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) alpha[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
    let cur = alpha;
    for (let pass = 0; pass < profile.edgeTrim; pass++) {
      const next = new Uint8Array(n);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (!cur[idx]) continue;
          if (
            cur[idx - 1] &&
            cur[idx + 1] &&
            cur[idx - w] &&
            cur[idx + w]
          ) {
            next[idx] = 1;
          }
        }
      }
      cur = next;
    }
    for (let i = 0; i < n; i++) {
      if (!cur[i]) px[i * 4 + 3] = 0;
      else if (px[i * 4 + 3] > 0) px[i * 4 + 3] = 255;
    }
  }

  // 4) Color decontamination on the remaining edge ring.
  defringeRgb(img);
}

function defringeRgb(img: ImageData): void {
  const w = img.width;
  const h = img.height;
  const px = img.data;
  const src = new Uint8ClampedArray(px);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] < 128) continue;
      let clear = false;
      for (let dy = -1; dy <= 1 && !clear; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (src[((y + dy) * w + (x + dx)) * 4 + 3] < 18) {
            clear = true;
            break;
          }
        }
      }
      if (!clear) continue;

      let rs = 0;
      let gs = 0;
      let bs = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = (ny * w + nx) * 4;
          if (src[j + 3] < 240) continue;
          // Prefer interior (not itself on the edge ring).
          let neighborClear = false;
          for (let ey = -1; ey <= 1 && !neighborClear; ey++) {
            for (let ex = -1; ex <= 1; ex++) {
              const exx = nx + ex;
              const eyy = ny + ey;
              if (exx < 0 || eyy < 0 || exx >= w || eyy >= h) continue;
              if (src[(eyy * w + exx) * 4 + 3] < 18) {
                neighborClear = true;
                break;
              }
            }
          }
          if (neighborClear) continue;
          rs += src[j];
          gs += src[j + 1];
          bs += src[j + 2];
          n++;
        }
      }
      if (n < 3) continue;
      px[i] = Math.round(rs / n);
      px[i + 1] = Math.round(gs / n);
      px[i + 2] = Math.round(bs / n);
      px[i + 3] = 255;
    }
  }
}

function cornersStillFloor(img: ImageData): boolean {
  const w = img.width;
  const h = img.height;
  const px = img.data;
  const pts = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
  ];
  let hit = 0;
  for (const [x, y] of pts) {
    if (px[(y * w + x) * 4 + 3] > 200) hit++;
  }
  return hit >= 3;
}

function keepMainSubject(img: ImageData): void {
  const w = img.width;
  const h = img.height;
  const px = img.data;
  const n = w * h;
  if (n > 1_600_000) return;
  const seen = new Int32Array(n);
  let label = 0;
  let bestLabel = 0;
  let bestArea = 0;
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (seen[start] || px[start * 4 + 3] < 40) continue;
    label += 1;
    let top = 0;
    stack[top++] = start;
    seen[start] = label;
    let area = 0;
    while (top) {
      const idx = stack[--top]!;
      area++;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0 && !seen[idx - 1] && px[(idx - 1) * 4 + 3] >= 40) {
        seen[idx - 1] = label;
        stack[top++] = idx - 1;
      }
      if (x + 1 < w && !seen[idx + 1] && px[(idx + 1) * 4 + 3] >= 40) {
        seen[idx + 1] = label;
        stack[top++] = idx + 1;
      }
      if (y > 0 && !seen[idx - w] && px[(idx - w) * 4 + 3] >= 40) {
        seen[idx - w] = label;
        stack[top++] = idx - w;
      }
      if (y + 1 < h && !seen[idx + w] && px[(idx + w) * 4 + 3] >= 40) {
        seen[idx + w] = label;
        stack[top++] = idx + w;
      }
    }
    if (area > bestArea) {
      bestLabel = label;
      bestArea = area;
    }
  }
  if (!bestLabel) return;
  for (let i = 0; i < n; i++) {
    if (seen[i] !== bestLabel) px[i * 4 + 3] = 0;
  }
}

function meanColor(
  px: Uint8ClampedArray,
  w: number,
  ys: number,
  ye: number,
  h: number,
): [number, number, number] | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const y0 = Math.max(0, ys);
  const y1 = Math.min(h, ye);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 18) continue;
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
  }
  if (n < 12) return null;
  return [r / n, g / n, b / n];
}

function colorDist(
  r: number,
  g: number,
  b: number,
  m: [number, number, number],
): number {
  const dr = r - m[0];
  const dg = g - m[1];
  const db = b - m[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Drop hook + bar. Keep the garment. Do not sew the collar shut. */
function stripHanger(img: ImageData): void {
  const w = img.width;
  const h = img.height;
  const px = img.data;
  const widths = new Int32Array(h);
  let maxW = 1;
  for (let y = 0; y < h; y++) {
    let c = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (px[(row + x) * 4 + 3] > 18) c++;
    }
    widths[y] = c;
    if (c > maxW) maxW = c;
  }

  let top = 0;
  while (top < h && widths[top] < 8) top++;
  let bot = h - 1;
  while (bot > top && widths[bot] < 8) bot--;
  if (bot - top < 20) return;

  const hookLimit = maxW * 0.26;
  let afterHook = top;
  while (afterHook < bot && widths[afterHook] < hookLimit) afterHook++;
  let y = afterHook;
  while (y < top + Math.round((bot - top) * 0.12) && widths[y] < maxW * 0.34) {
    afterHook = y + 1;
    y++;
  }

  const hookMean = meanColor(px, w, top, afterHook, h);
  const bodyMean = meanColor(
    px,
    w,
    Math.round(top + (bot - top) * 0.4),
    Math.round(top + (bot - top) * 0.75),
    h,
  );

  for (y = top; y < afterHook; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) px[(row + x) * 4 + 3] = 0;
  }

  const hangerDistinct =
    hookMean &&
    bodyMean &&
    colorDist(hookMean[0], hookMean[1], hookMean[2], bodyMean) > 28;

  const bandEnd = Math.min(
    bot,
    afterHook + Math.max(8, Math.round((bot - top) * 0.16)),
  );

  if (hangerDistinct && hookMean) {
    for (y = afterHook; y < bandEnd; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = (row + x) * 4;
        if (px[i + 3] < 18) continue;
        if (colorDist(px[i], px[i + 1], px[i + 2], hookMean) < 42) {
          px[i + 3] = 0;
        }
      }
    }
  }

  const shoulder = afterHook + Math.round((bot - top) * 0.08);
  for (y = top; y < Math.min(shoulder, h); y++) {
    if (widths[y] >= maxW * 0.3) continue;
    const row = y * w;
    for (let x = 0; x < w; x++) px[(row + x) * 4 + 3] = 0;
  }

  const tmp = new Uint8ClampedArray(px);
  const y0 = Math.max(1, afterHook - 2);
  const y1 = Math.min(h - 1, bandEnd + 4);
  for (y = y0; y < y1; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = (y * w + x) * 4;
      if (tmp[i + 3] >= 18) continue;
      let op = 0;
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let left = false;
      let right = false;
      let down = false;
      for (let dy = -2; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
          const j = (ny * w + nx) * 4;
          if (tmp[j + 3] < 18) continue;
          op++;
          rs += tmp[j];
          gs += tmp[j + 1];
          bs += tmp[j + 2];
          if (dx < 0) left = true;
          if (dx > 0) right = true;
          if (dy > 0) down = true;
        }
      }
      if (!left || !right || !down || op < 8) continue;
      px[i] = Math.round(rs / op);
      px[i + 1] = Math.round(gs / op);
      px[i + 2] = Math.round(bs / op);
      px[i + 3] = 255;
    }
  }
}

async function cropIsolate(
  src: HTMLCanvasElement,
  data: ImageData,
): Promise<Blob> {
  const px = data.data;
  let x0 = src.width;
  let y0 = src.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (px[(y * src.width + x) * 4 + 3] < 18) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error("No garment in the cut");
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(src.width, x1 + pad + 1);
  y1 = Math.min(src.height, y1 + pad + 1);
  const cw = x1 - x0;
  const ch = y1 - y0;
  const scale = Math.min(1, 1400 / Math.max(cw, ch));
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));
  const tile = document.createElement("canvas");
  tile.width = nw;
  tile.height = nh;
  const tctx = tile.getContext("2d");
  if (!tctx) throw new Error("Could not isolate cut");
  tctx.clearRect(0, 0, nw, nh);
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(src, x0, y0, cw, ch, 0, 0, nw, nh);
  const blob = await blobFromCanvas(tile);
  if (!blob) throw new Error("Could not encode cut");
  return blob;
}

/** Flood-fill fallback only. Do not use on white clothes. */
export function knockBackground(img: HTMLImageElement, maxEdge = 1400): string {
  const key = img.src;
  const hit = cache.get(key);
  if (hit) return hit;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const samples = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const i of samples) {
    br += px[i];
    bg += px[i + 1];
    bb += px[i + 2];
  }
  br /= 4;
  bg /= 4;
  bb /= 4;
  const HARD = 22;
  const SOFT = 40;
  const hard2 = HARD * HARD;
  const soft2 = SOFT * SOFT;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    if (dist2(px, idx * 4, br, bg, bb) > soft2) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop()!;
    const i = idx * 4;
    const d = dist2(px, i, br, bg, bb);
    if (d < hard2) px[i + 3] = 0;
    else {
      const a = (Math.sqrt(d) - HARD) / (SOFT - HARD);
      px[i + 3] = Math.max(0, Math.min(255, Math.round(255 * a)));
    }
    const x = idx % w;
    const y = (idx / w) | 0;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
  // Harden the flood-fill matte the same way product cuts do.
  refineMatte(data, {
    maxEdge,
    alphaKill: 64,
    alphaSolid: 210,
    edgeTrim: 1,
    stripHanger: false,
  });
  ctx.putImageData(data, 0, 0);
  const out = canvas.toDataURL("image/png");
  if (cache.size > 48) cache.clear();
  cache.set(key, out);
  return out;
}

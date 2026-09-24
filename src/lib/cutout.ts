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
  /** Peel a dark rim that is darker than the cloth behind it (olive hems). */
  peelDark: boolean;
  stripHanger: boolean;
};

const PROFILES: Record<CutMode, CutProfile> = {
  garment: {
    maxEdge: 1280,
    // Mid-alpha fringe used to be locked solid (halo). Kill more of it.
    alphaKill: 96,
    alphaSolid: 208,
    edgeTrim: 1,
    peelDark: true,
    stripHanger: true,
  },
  product: {
    maxEdge: 1600,
    // Same fringe kill as clothes. No choke: a 1–2px trim ate soft
    // bottle silhouettes and the label ring around them.
    alphaKill: 96,
    alphaSolid: 208,
    edgeTrim: 0,
    peelDark: false,
    stripHanger: false,
  },
};

/** Transparent margin kept around a new cut, as a fraction of the subject. */
export const CUT_PAD = 0.05;

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

/** Apply the garment or product matte to pixels already on screen. */
export function hardenMatte(img: ImageData, mode: CutMode): void {
  refineMatte(img, PROFILES[mode]);
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

function nearWhite(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  return mx / 255 > 0.8 && sat < 0.12;
}

function touchesClear(alpha: Uint8Array, w: number, h: number, idx: number): boolean {
  const x = idx % w;
  const y = (idx / w) | 0;
  if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return true;
  return (
    alpha[idx - 1]! < 18 ||
    alpha[idx + 1]! < 18 ||
    alpha[idx - w]! < 18 ||
    alpha[idx + w]! < 18
  );
}

/**
 * Harden the matte so tiles never show fuzzy halos:
 * kill weak alpha, solidify the rest, trim edge fringe, defringe RGB.
 * Interior whites (shirts, labels) stay; only fringe-white is removed.
 */
export function refineMatte(img: ImageData, profile: CutProfile): void {
  const px = img.data;
  const w = img.width;
  const h = img.height;
  const n = w * h;
  const alpha0 = new Uint8Array(n);
  for (let i = 0; i < n; i++) alpha0[i] = px[i * 4 + 3]!;

  // 1) White / gray fringe → transparent. Do not eat

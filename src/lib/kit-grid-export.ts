/**
 * Renders the clothing kit already on a Today look tile (OUTER / TOP / BOTTOM /
 * SHOES / BAG) to a PNG. Share sheet when the browser can share files, otherwise
 * a download. Never opens a file picker.
 *
 * Rasterize stays synchronous and `navigator.share` is invoked before the first
 * await so the click's user gesture is still active on phones.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type KitExportResult = "shared" | "downloaded" | "cancelled";

export function containBox(box: Box, naturalWidth: number, naturalHeight: number): Box {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const scale = Math.min(box.w / nw, box.h / nh);
  const w = nw * scale;
  const h = nh * scale;
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  };
}

export function kitExportFilename(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `atelier-kit-${slug || "look"}.png`;
}

export function chooseDelivery(canShareFiles: boolean): "share" | "download" {
  return canShareFiles ? "share" : "download";
}

export async function exportLookKitGrid(grid: HTMLElement, name: string): Promise<KitExportResult> {
  const blob = rasterizeKitGrid(grid);
  return deliverKitPng(blob, kitExportFilename(name));
}

export function rasterizeKitGrid(grid: HTMLElement): Blob {
  const tiles = [...grid.querySelectorAll<HTMLElement>(".kit-tile")];
  if (!tiles.length) throw new Error("This look has no kit tiles");

  const rects = tiles.map((tile) => tile.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const pad = 2;
  const cssW = right - left + pad * 2;
  const cssH = bottom - top + pad * 2;
  if (cssW < 8 || cssH < 8) throw new Error("Kit grid is not on screen");

  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssW * scale);
  canvas.height = Math.round(cssH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw kit grid");

  const card = grid.closest(".look-kit");
  ctx.fillStyle = paintColor(card ? getComputedStyle(card).backgroundColor : "", "#f4f0e8");
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let wanted = 0;
  let drew = 0;
  for (const tile of tiles) {
    const painted = paintTile(ctx, tile, left - pad, top - pad, scale);
    wanted += painted.wanted;
    drew += painted.drew;
  }
  if (wanted > 0 && drew === 0) {
    throw new Error("Could not read the kit images");
  }
  return canvasToPngBlob(canvas);
}

async function deliverKitPng(blob: Blob, filename: string): Promise<KitExportResult> {
  const file = new File([blob], filename, { type: "image/png" });
  if (chooseDelivery(canShareFile(file)) === "share") {
    try {
      await navigator.share({ files: [file], title: shareTitle(filename) });
      return "shared";
    } catch (err) {
      if (isAbort(err)) return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  tile: HTMLElement,
  originX: number,
  originY: number,
  scale: number,
): { wanted: number; drew: number } {
  const tileBox = rel(tile.getBoundingClientRect(), originX, originY, scale);
  const radius = (parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 12) * scale;

  ctx.save();
  traceRoundRect(ctx, tileBox, radius);
  ctx.clip();
  ctx.fillStyle = paintColor(getComputedStyle(tile).backgroundColor, "#fbfbf8");
  ctx.fillRect(tileBox.x, tileBox.y, tileBox.w, tileBox.h);

  const studio = tile.querySelector<HTMLElement>(".outfit-studio");
  let wanted = 0;
  let drew = 0;
  if (studio) {
    const studioBox = rel(studio.getBoundingClientRect(), originX, originY, scale);
    ctx.fillStyle = paintColor(getComputedStyle(studio).backgroundColor, "#f6f1e8");
    ctx.fillRect(studioBox.x, studioBox.y, studioBox.w, studioBox.h);
    const img = studio.querySelector("img");
    if (img) {
      wanted = 1;
      const bitmap = readableImage(img);
      if (bitmap) {
        const content = contentBox(studioBox, img, scale);
        const fitted = containBox(content, bitmap.naturalWidth, bitmap.naturalHeight);
        ctx.save();
        ctx.beginPath();
        ctx.rect(studioBox.x, studioBox.y, studioBox.w, studioBox.h);
        ctx.clip();
        ctx.drawImage(bitmap, fitted.x, fitted.y, fitted.w, fitted.h);
        ctx.restore();
        drew = 1;
      }
    }
  }

  const label = tile.querySelector<HTMLElement>(".kit-label");
  if (label) paintLabel(ctx, label, originX, originY, scale);
  ctx.restore();

  ctx.save();
  traceRoundRect(ctx, tileBox, radius);
  ctx.strokeStyle = "rgba(28, 25, 20, 0.14)";
  ctx.lineWidth = Math.max(1, scale);
  ctx.stroke();
  ctx.restore();
  return { wanted, drew };
}

function paintLabel(
  ctx: CanvasRenderingContext2D,
  label: HTMLElement,
  originX: number,
  originY: number,
  scale: number,
) {
  const box = rel(label.getBoundingClientRect(), originX, originY, scale);
  const style = getComputedStyle(label);
  ctx.fillStyle = paintColor(style.backgroundColor, "#fbfbf8");
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const text = labelText(label, style.textTransform);
  if (!text) return;
  const fontSize = (parseFloat(style.fontSize) || 10) * scale;
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.fillStyle = style.color || "#3f3b36";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const tracking = parseFloat(style.letterSpacing);
  if ("letterSpacing" in ctx && Number.isFinite(tracking)) {
    ctx.letterSpacing = `${tracking * scale}px`;
  }
  const padLeft = (parseFloat(style.paddingLeft) || 0) * scale;
  ctx.fillText(text, box.x + padLeft, box.y + box.h / 2, Math.max(1, box.w - padLeft));
}

function contentBox(studio: Box, img: HTMLImageElement, scale: number): Box {
  const style = getComputedStyle(img);
  const pl = (parseFloat(style.paddingLeft) || 0) * scale;
  const pr = (parseFloat(style.paddingRight) || 0) * scale;
  const pt = (parseFloat(style.paddingTop) || 0) * scale;
  const pb = (parseFloat(style.paddingBottom) || 0) * scale;
  return {
    x: studio.x + pl,
    y: studio.y + pt,
    w: Math.max(1, studio.w - pl - pr),
    h: Math.max(1, studio.h - pt - pb),
  };
}

function readableImage(img: HTMLImageElement): HTMLImageElement | null {
  if (!img.complete || !img.naturalWidth) return null;
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return img;
  } catch {
    return null;
  }
}

function rel(rect: DOMRect, originX: number, originY: number, scale: number): Box {
  return {
    x: (rect.left - originX) * scale,
    y: (rect.top - originY) * scale,
    w: rect.width * scale,
    h: rect.height * scale,
  };
}

function traceRoundRect(ctx: CanvasRenderingContext2D, box: Box, radius: number) {
  const r = Math.min(Math.max(0, radius), box.w / 2, box.h / 2);
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, r);
}

function labelText(label: HTMLElement, textTransform: string): string {
  const raw = (label.textContent ?? "").replace(/\s+/g, " ").trim();
  if (textTransform === "uppercase") return raw.toUpperCase();
  if (textTransform === "lowercase") return raw.toLowerCase();
  return raw;
}

function paintColor(color: string, fallback: string): string {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
    return fallback;
  }
  return color;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Blob {
  const url = canvas.toDataURL("image/png");
  const comma = url.indexOf(",");
  const header = url.slice(0, comma);
  const data = url.slice(comma + 1);
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

function shareTitle(filename: string): string {
  return filename.replace(/\.png$/i, "").replace(/-/g, " ");
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

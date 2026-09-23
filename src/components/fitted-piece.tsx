import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hardenMatte, trimSubjectView, type CutMode } from "@/lib/cutout";
import { cn } from "@/lib/utils";

const useIsoLayout =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

const viewCache = new Map<string, string | null>();
let viewBoxOk: boolean | null = null;

function canUseViewBox(): boolean {
  if (viewBoxOk !== null) return viewBoxOk;
  viewBoxOk =
    typeof CSS !== "undefined" &&
    CSS.supports("object-view-box", "xywh(0px 0px 1px 1px)");
  return viewBoxOk;
}

/** Sample a small copy so a loose transparent margin can be framed out. */
function subjectViewCss(img: HTMLImageElement): string | null {
  const key = img.currentSrc || img.src;
  const hit = viewCache.get(key);
  if (hit !== undefined) return hit;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  let css: string | null = null;
  if (nw >= 2 && nh >= 2) {
    const maxEdge = 128;
    const scale = Math.min(1, maxEdge / Math.max(nw, nh));
    const sw = Math.max(1, Math.round(nw * scale));
    const sh = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, 0, 0, sw, sh);
      try {
        const data = ctx.getImageData(0, 0, sw, sh).data;
        let x0 = sw;
        let y0 = sh;
        let x1 = -1;
        let y1 = -1;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (data[(y * sw + x) * 4 + 3]! < 18) continue;
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
          }
        }
        if (x1 >= 0) {
          const sx = nw / sw;
          const sy = nh / sh;
          const box = trimSubjectView(nw, nh, {
            x0: Math.floor(x0 * sx),
            y0: Math.floor(y0 * sy),
            x1: Math.min(nw - 1, Math.ceil((x1 + 1) * sx) - 1),
            y1: Math.min(nh - 1, Math.ceil((y1 + 1) * sy) - 1),
          });
          if (box) css = `xywh(${box.x}px ${box.y}px ${box.w}px ${box.h}px)`;
        }
      } catch {
        css = null;
      }
    }
  }
  if (viewCache.size > 200) viewCache.clear();
  viewCache.set(key, css);
  return css;
}

function frameCutout(img: HTMLImageElement) {
  if (!canUseViewBox()) return;
  const css = subjectViewCss(img);
  img.style.setProperty("object-view-box", css ?? "");
}

const cleanCache = new Map<string, string | null>();
let cleanQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = cleanQueue.then(job, job);
  cleanQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function rememberClean(key: string, url: string | null) {
  if (cleanCache.size > 80) {
    const oldest = cleanCache.keys().next().value;
    if (oldest) {
      const prev = cleanCache.get(oldest);
      if (typeof prev === "string") URL.revokeObjectURL(prev);
      cleanCache.delete(oldest);
    }
  }
  cleanCache.set(key, url);
}

function cachedClean(src: string, mode: CutMode): string | null {
  return cleanCache.get(`${mode}:${src}`) ?? null;
}

/**
 * Existing sample cuts still have a soft fringe. Harden that for display.
 * Opaque plates and already-crisp cuts are left alone.
 */
async function hardenForDisplay(
  img: HTMLImageElement,
  mode: CutMode,
): Promise<string | null> {
  const key = `${mode}:${img.currentSrc || img.src}`;
  if (cleanCache.has(key)) return cleanCache.get(key) ?? null;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw < 2 || nh < 2) {
    rememberClean(key, null);
    return null;
  }
  const scale = Math.min(1, 720 / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    rememberClean(key, null);
    return null;
  }
  let soft = 0;
  for (let i = 3; i < data.data.length; i += 16) {
    const a = data.data[i]!;
    if (a > 16 && a < 248) soft++;
  }
  if (soft < 48) {
    rememberClean(key, null);
    return null;
  }
  hardenMatte(data, mode);
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!blob) {
    rememberClean(key, null);
    return null;
  }
  const url = URL.createObjectURL(blob);
  const pre = new Image();
  pre.src = url;
  try {
    await pre.decode();
  } catch {
    /* the tile img will decode it */
  }
  rememberClean(key, url);
  return url;
}

export function FittedPiece({
  src,
  alt = "",
  eager,
  cut = "garment",
  className,
  onRatio,
}: {
  src: string;
  alt?: string;
  eager?: boolean;
  cut?: CutMode;
  className?: string;
  onRatio?: (ratio: number) => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState(() => cachedClean(src, cut) ?? src);
  const [trackedSrc, setTrackedSrc] = useState(src);
  const [trackedCut, setTrackedCut] = useState(cut);
  const [failed, setFailed] = useState(false);
  if (src !== trackedSrc || cut !== trackedCut) {
    setTrackedSrc(src);
    setTrackedCut(cut);
    setShown(cachedClean(src, cut) ?? src);
    setFailed(false);
  }

  useIsoLayout(() => {
    const img = ref.current;
    if (!img) return;
    let live = true;
    img.style.setProperty("object-view-box", "");
    const apply = () => {
      if (!img.naturalWidth) return;
      onRatio?.(img.naturalWidth / img.naturalHeight);
      frameCutout(img);
      const source = img.currentSrc || img.src;
      void enqueue(() => hardenForDisplay(img, cut)).then((url) => {
        if (!live || !url || url === source) return;
        setShown(url);
      });
    };
    if (img.complete && img.naturalWidth) apply();
    img.addEventListener("load", apply);
    return () => {
      live = false;
      img.removeEventListener("load", apply);
    };
  }, [shown, onRatio, cut]);

  if (failed) return null;

  return (
    <img
      ref={ref}
      src={shown}
      alt={alt}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      fetchPriority={eager ? "high" : "auto"}
      onLoad={() => {
        const img = ref.current;
        if (!img?.naturalWidth) return;
        onRatio?.(img.naturalWidth / img.naturalHeight);
        frameCutout(img);
      }}
      onError={() => {
        const bare = shown.split("?")[0];
        if (bare && bare !== shown) {
          setShown(bare);
          return;
        }
        setFailed(true);
      }}
      className={cn("size-full object-contain object-center", className)}
    />
  );
}

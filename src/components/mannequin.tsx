import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Minus, Plus } from "lucide-react";
import { knockBackground, needsCutout } from "@/lib/cutout";
import { useLookEditor } from "@/lib/editor";
import {
  fitSlot,
  garmentAspect,
  mergeBoard,
  type BoardSlot,
} from "@/lib/board";
import { pieceSrc } from "@/lib/media";
import { isCoat } from "@/lib/look";
import { useWardrobe } from "@/lib/store";
import type { Extra, Garment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LookGrid } from "@/components/look-grid";

function useDisplaySrc(raw?: string) {
  const [src, setSrc] = useState(raw);
  useEffect(() => {
    if (!raw) {
      setSrc(undefined);
      return;
    }
    if (!needsCutout(raw)) {
      setSrc(raw);
      return;
    }
    let gone = false;
    const img = new Image();
    img.onload = () => {
      if (gone) return;
      try {
        setSrc(knockBackground(img));
      } catch {
        setSrc(raw);
      }
    };
    img.onerror = () => {
      if (!gone) setSrc(raw);
    };
    img.src = raw;
    return () => {
      gone = true;
    };
  }, [raw]);
  return src;
}

function isHat(g: Garment) {
  return /\b(hat|cap|beanie|beret|fedora|bucket)\b/i.test(
    `${g.name} ${g.notes}`,
  );
}

function Piece({
  src,
  name,
  className,
  fit,
  style,
  eager,
}: {
  src?: string;
  name: string;
  className?: string;
  fit?: "contain" | "absolute";
  style?: CSSProperties;
  eager?: boolean;
}) {
  const display = useDisplaySrc(src);
  if (!display) return null;
  return (
    <img
      src={display}
      alt={name}
      title={name}
      style={style}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "low"}
      className={cn(
        "pointer-events-none select-none object-contain",
        fit === "absolute" ? "piece-float absolute" : "h-full w-full",
        className,
      )}
    />
  );
}

function useNaturalAspect(src: string | undefined, fallback: number) {
  const [aspect, setAspect] = useState(fallback);
  useEffect(() => {
    setAspect(fallback);
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = src;
  }, [src, fallback]);
  return aspect;
}

function slotsOf(garments: Garment[]) {
  const outer = garments.find((g) => g.category === "outerwear");
  const dress = garments.find((g) => g.category === "dresses");
  const top = garments.find((g) => g.category === "tops");
  const bottom = garments.find((g) => g.category === "bottoms");
  const feet = garments.find((g) => g.category === "footwear");
  const bag = garments.find((g) => g.category === "bags");
  const accessories = garments.filter((g) => g.category === "accessories");
  const hat = accessories.find(isHat);
  const rail = [
    ...accessories.filter((g) => g !== hat),
    ...(bag ? [bag] : []),
  ];
  const torso = dress ?? outer ?? top;
  return { outer, dress, top, bottom, feet, hat, rail, torso };
}

export function isTrayItem(g: Garment) {
  return g.category === "bags" || (g.category === "accessories" && !isHat(g));
}

export function AccessoryWell({
  items,
  onPlace,
}: {
  items: Garment[];
  onPlace?: (id: string) => void;
}) {
  return (
    <aside
      className="accessory-well flex w-full flex-col gap-1 rounded-xl p-1"
      aria-label="Accessories"
    >
      <p className="px-0.5 text-center text-[8px] leading-tight tracking-[0.14em] text-neutral-500 uppercase">
        Accessories
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
        {items.map((g) => {
          const src = pieceSrc(g);
          return (
            <div
              key={g.id}
              className="relative aspect-square w-full overflow-hidden"
              title={g.name}
            >
              {src ? (
                <img
                  src={src}
                  alt={g.name}
                  draggable={false}
                  className="size-full object-contain"
                />
              ) : null}
              {onPlace ? (
                <button
                  type="button"
                  aria-label={`Place ${g.name} on outfit`}
                  className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-900 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlace(g.id);
                  }}
                >
                  <Plus className="size-2.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function HiddenDock({
  items,
  onRestore,
}: {
  items: Garment[];
  onRestore: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1" aria-label="Removed pieces">
      {items.map((g) => {
        const src = pieceSrc(g);
        return (
          <button
            key={g.id}
            type="button"
            title={`Put ${g.name} back`}
            onClick={() => onRestore(g.id)}
            className="relative aspect-square w-full overflow-hidden rounded-lg bg-black/5"
          >
            {src ? (
              <img
                src={src}
                alt={g.name}
                draggable={false}
                className="size-full object-contain"
              />
            ) : null}
            <span className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-neutral-900 text-white">
              <Plus className="size-2.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const OUTFIT_STAGE =
  "grid grid-cols-[minmax(0,1fr)_4.85rem] items-start gap-1.5 p-1.5 sm:grid-cols-[minmax(0,1fr)_5.35rem]";

function GuidelinesToggle({ canvasId }: { canvasId: string }) {
  const showGuides = useLookEditor(
    (s) => s.showGuides && s.canvasId === canvasId,
  );
  return (
    <button
      type="button"
      data-look-canvas={canvasId}
      className={cn(
        "w-full rounded-lg px-1 py-1.5 text-center text-[8px] leading-tight tracking-[0.12em] uppercase shadow-sm",
        showGuides
          ? "bg-sky-600 text-white"
          : "bg-white/90 text-neutral-600 hover:text-neutral-900",
      )}
      onClick={(e) => {
        e.stopPropagation();
        const st = useLookEditor.getState();
        if (st.canvasId !== canvasId) {
          st.select(canvasId, null);
          st.setGuides(true);
          return;
        }
        st.setGuides(!st.showGuides);
      }}
    >
      Guidelines
    </button>
  );
}

function LayerSwap({
  outer,
  top,
  pick,
  onPick,
}: {
  outer: Garment;
  top: Garment;
  pick: "outer" | "top";
  onPick: (next: "outer" | "top") => void;
}) {
  const options: { id: "outer" | "top"; item: Garment; label: string }[] = [
    {
      id: "outer",
      item: outer,
      label: isCoat(outer) ? "Coat" : "Jacket",
    },
    { id: "top", item: top, label: "Shirt" },
  ];
  return (
    <aside
      className="accessory-well flex items-center gap-1.5 rounded-xl p-1"
      aria-label="Jacket or shirt"
    >
      <p className="w-9 shrink-0 text-center text-[8px] leading-tight tracking-[0.14em] text-neutral-500 uppercase">
        Layer
      </p>
      <div className="flex min-w-0 flex-1 gap-1">
        {options.map(({ id, item, label }) => {
          const src = pieceSrc(item);
          const on = pick === id;
          return (
            <button
              key={id}
              type="button"
              title={`Show ${item.name}`}
              onClick={() => onPick(id)}
              className={cn(
                "relative h-12 min-w-0 flex-1 overflow-hidden rounded-md",
                on ? "ring-1 ring-neutral-800" : "opacity-55",
              )}
            >
              {src ? (
                <img
                  src={src}
                  alt={item.name}
                  draggable={false}
                  className="size-full object-contain"
                />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-center text-[7px] tracking-wide text-white uppercase">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function OutfitStage({
  garments,
  hidden,
  docked,
  className,
  children,
  canvasId,
  onHide,
  onRestore,
  onPlace,
  layerOuter,
  layerTop,
  layerPick,
  onLayerPick,
}: {
  garments: Garment[];
  hidden?: Garment[];
  docked?: Garment[];
  className?: string;
  children: ReactNode;
  canvasId?: string;
  onHide?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPlace?: (id: string) => void;
  layerOuter?: Garment;
  layerTop?: Garment;
  layerPick?: "outer" | "top";
  onLayerPick?: (next: "outer" | "top") => void;
}) {
  const tray = docked ?? garments.filter(isTrayItem);
  return (
    <div className={cn(OUTFIT_STAGE, className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="overflow-hidden rounded-xl">{children}</div>
        {layerOuter && layerTop && layerPick && onLayerPick ? (
          <LayerSwap
            outer={layerOuter}
            top={layerTop}
            pick={layerPick}
            onPick={onLayerPick}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <AccessoryWell items={tray} onPlace={onPlace} />
        {hidden?.length && onRestore ? (
          <HiddenDock items={hidden} onRestore={onRestore} />
        ) : null}
        {canvasId ? <GuidelinesToggle canvasId={canvasId} /> : null}
      </div>
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type Place = {
  item: Garment;
  cx: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

function placesOf(garments: Garment[], board: BoardSlot[]): Place[] {
  const { outer, dress, top, bottom, feet, hat, rail } = slotsOf(garments);
  const box = Object.fromEntries(board.map((s) => [s.id, s])) as Record<
    BoardSlot["id"],
    BoardSlot
  >;
  const out: Place[] = [];
  const put = (item: Garment | undefined, slot?: BoardSlot, z = 4) => {
    if (!item || !slot?.visible) return;
    const fitted = fitSlot(slot, garmentAspect(item, slot.id));
    out.push({
      item,
      cx: fitted.cx,
      y: fitted.y,
      w: fitted.w,
      h: fitted.h,
      z,
    });
  };
  put(hat, box.hat, 7);
  put(bottom && !dress ? bottom : undefined, box.bottoms, 2);
  put(top && !dress ? top : undefined, box.tops, 3);
  put(dress, box.dresses, 4);
  put(outer && !dress ? outer : undefined, box.outerwear, 5);
  put(feet, box.footwear, 6);
  const accs = garments.filter(
    (g) => g.category === "accessories" && !isHat(g),
  );
  const bags = garments.filter((g) => g.category === "bags");
  accs.forEach((item, i) => {
    if (!box.accessory?.visible) return;
    put(
      item,
      {
        ...box.accessory,
        y: box.accessory.y + i * 16,
      },
      8,
    );
  });
  bags.forEach((item, i) => {
    if (!box.bag?.visible) return;
    put(
      item,
      {
        ...box.bag,
        y: box.bag.y + i * 18,
      },
      8,
    );
  });
  return out;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se";

type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origScale: number;
  canvasW: number;
  canvasH: number;
  cx: number;
  y: number;
  w: number;
  h: number;
  centerPxX: number;
  centerPxY: number;
  startDist: number;
};

type Live = { id: string; x: number; y: number; scale: number };

const HANDLES: { mode: DragMode; className: string; cursor: string }[] = [
  { mode: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { mode: "ne", className: "-right-1 -top-1", cursor: "nesw-resize" },
  { mode: "sw", className: "-left-1 -bottom-1", cursor: "nesw-resize" },
  { mode: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
];

function PlacedGarment({
  place,
  overlay,
  pose,
  selected,
  eager,
  onDown,
  onHide,
}: {
  place: Place;
  overlay: Live | null;
  pose: { x: number; y: number; scale: number };
  selected: boolean;
  eager?: boolean;
  onDown: (
    e: ReactPointerEvent,
    place: Place,
    mode: DragMode,
  ) => void;
  onHide?: (id: string) => void;
}) {
  const src = pieceSrc(place.item);
  const fallback = (place.w / Math.max(place.h, 1)) * (4 / 5);
  const aspect = useNaturalAspect(src, fallback);
  const fitted = fitSlot(
    {
      id: "tops",
      label: "",
      visible: true,
      cx: place.cx,
      y: place.y,
      w: place.w,
      h: place.h,
    },
    aspect,
  );
  const box: Place = { ...place, w: fitted.w, h: fitted.h };
  const scale = overlay ? overlay.scale : pose.scale;
  const x = overlay ? overlay.x : pose.x;
  const y = overlay ? overlay.y : pose.y;
  return (
    <div
      onPointerDown={(e) => onDown(e, box, "move")}
      onClick={(e) => e.stopPropagation()}
      title={place.item.name}
      className={cn(
        "absolute touch-none",
        selected ? "z-20 cursor-move" : "cursor-grab",
      )}
      style={{
        left: `${box.cx + x}%`,
        top: `${box.y + y}%`,
        width: `${box.w * scale}%`,
        height: `${box.h * scale}%`,
        transform: "translateX(-50%)",
        zIndex: selected ? 20 : place.z,
        willChange: overlay ? "left, top, width, height" : undefined,
      }}
    >
      <Piece src={src} name={place.item.name} eager={eager} />
      {selected ? (
        <>
          <div className="pointer-events-none absolute inset-0 ring-1 ring-sky-500/80" />
          {HANDLES.map((h) => (
            <span
              key={h.mode}
              onPointerDown={(e) => onDown(e, box, h.mode)}
              className={cn(
                "absolute z-30 size-2.5 rounded-[1px] border border-sky-700 bg-white shadow-sm",
                h.className,
              )}
              style={{ cursor: h.cursor }}
            />
          ))}
          {onHide ? (
            <button
              type="button"
              aria-label={`Hide ${place.item.name}`}
              className="absolute -top-2 -right-2 z-40 flex size-5 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onHide(place.item.id);
              }}
            >
              <Minus className="size-3" />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StackedMannequin({
  garments,
  className,
  eager,
  layoutKey,
  canvasId,
  onHide,
}: {
  garments: Garment[];
  extras?: Extra[];
  className?: string;
  compact?: boolean;
  eager?: boolean;
  layoutKey?: string;
  canvasId: string;
  onHide?: (id: string) => void;
}) {
  const poses = useWardrobe((s) =>
    layoutKey ? s.profile.pieceLayout?.[layoutKey] : undefined,
  );
  const boardSlots = useWardrobe((s) => s.profile.boardSlots);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const liveRef = useRef<Live | null>(null);
  const rafRef = useRef(0);
  const [live, setLive] = useState<Live | null>(null);
  const selectedId = useLookEditor((s) =>
    s.canvasId === canvasId ? s.pieceId : null,
  );
  const showGuides = useLookEditor(
    (s) => s.showGuides && s.canvasId === canvasId,
  );
  const [snapX, setSnapX] = useState(false);
  const [snapY, setSnapY] = useState(false);

  const { dress, bottom, feet, hat, rail, torso } = slotsOf(garments);
  const empty = !torso && !bottom && !feet && !hat && rail.length === 0;
  const missingTop = !torso && Boolean(bottom || feet);
  const places = placesOf(garments, mergeBoard(boardSlots));
  const selected = garments.find((g) => g.id === selectedId);

  function poseOf(id: string) {
    const p = poses?.[id];
    return { x: p?.x ?? 0, y: p?.y ?? 0, scale: p?.scale ?? 1 };
  }

  function persist(
    id: string,
    patch: { displayX?: number; displayY?: number; displayScale?: number },
  ) {
    if (!layoutKey) return;
    const state = useWardrobe.getState();
    const all = { ...(state.profile.pieceLayout ?? {}) };
    const cur = { ...(all[layoutKey] ?? {}) };
    const prev = cur[id] ?? { x: 0, y: 0, scale: 1 };
    cur[id] = {
      x: patch.displayX ?? prev.x,
      y: patch.displayY ?? prev.y,
      scale: patch.displayScale ?? prev.scale,
    };
    state.setProfile({ pieceLayout: { ...all, [layoutKey]: cur } });
  }

  function pushLive(next: Live) {
    liveRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const cur = liveRef.current;
      if (cur) setLive({ ...cur });
    });
  }

  function onDown(
    e: ReactPointerEvent,
    place: Place,
    mode: DragMode,
  ) {
    e.stopPropagation();
    e.preventDefault();
    useLookEditor.getState().select(canvasId, place.item.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pose = poseOf(place.item.id);
    const origX = pose.x;
    const origY = pose.y;
    const origScale = pose.scale;
    const centerPxX = rect.left + ((place.cx + origX) / 100) * rect.width;
    const centerPxY =
      rect.top + ((place.y + origY + (place.h * origScale) / 2) / 100) * rect.height;
    const startDist = Math.hypot(e.clientX - centerPxX, e.clientY - centerPxY);
    drag.current = {
      id: place.item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
      origScale,
      canvasW: rect.width,
      canvasH: rect.height,
      cx: place.cx,
      y: place.y,
      w: place.w,
      h: place.h,
      centerPxX,
      centerPxY,
      startDist: Math.max(8, startDist),
    };
    liveRef.current = {
      id: place.item.id,
      x: origX,
      y: origY,
      scale: origScale,
    };

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      ev.preventDefault();
      if (d.mode === "move") {
        const dx = ((ev.clientX - d.startX) / d.canvasW) * 100;
        const dy = ((ev.clientY - d.startY) / d.canvasH) * 100;
        let nx = clamp(d.origX + dx, 8 - d.cx, 92 - d.cx);
        let ny = clamp(d.origY + dy, 2 - d.y, 90 - d.y);
        let sx = false;
        let sy = false;
        if (showGuides) {
          const absCx = d.cx + nx;
          const absCy = d.y + ny + (d.h * d.origScale) / 2;
          if (Math.abs(absCx - 50) < 1.6) {
            nx = 50 - d.cx;
            sx = true;
          }
          if (Math.abs(absCy - 50) < 1.6) {
            ny = 50 - (d.h * d.origScale) / 2 - d.y;
            sy = true;
          }
        }
        setSnapX(sx);
        setSnapY(sy);
        pushLive({ id: d.id, x: nx, y: ny, scale: d.origScale });
        return;
      }
      const dist = Math.hypot(ev.clientX - d.centerPxX, ev.clientY - d.centerPxY);
      let ns = d.origScale * (dist / d.startDist);
      ns = Math.min(2.2, Math.max(0.4, ns));
      pushLive({ id: d.id, x: d.origX, y: d.origY, scale: ns });
    };

    const up = () => {
      const last = liveRef.current;
      drag.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (last) {
        persist(last.id, {
          displayX: round(last.x),
          displayY: round(last.y),
          displayScale: round(last.scale),
        });
      }
      liveRef.current = null;
      setLive(null);
      setSnapX(false);
      setSnapY(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function resetSelected() {
    if (!selected) return;
    persist(selected.id, {
      displayX: 0,
      displayY: 0,
      displayScale: 1,
    });
  }

  return (
    <div
      ref={canvasRef}
      className={cn(
        "outfit-studio relative w-full overflow-hidden",
        "aspect-[4/5]",
        className,
      )}
      data-look-canvas={canvasId}
      role="img"
      aria-label="Outfit"
      onClick={() => useLookEditor.getState().select(canvasId, null)}
    >
      {empty ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
          No pieces yet
        </p>
      ) : null}

      {showGuides && !empty ? (
        <>
          <div
            className={cn(
              "pointer-events-none absolute top-0 bottom-0 left-1/2 z-30 w-px -translate-x-1/2",
              snapX ? "bg-sky-500" : "bg-sky-400/55",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute right-0 left-0 top-1/2 z-30 h-px -translate-y-1/2",
              snapY ? "bg-sky-500" : "bg-sky-400/55",
            )}
          />
        </>
      ) : null}

      {places.map((place) => (
        <PlacedGarment
          key={place.item.id}
          place={place}
          overlay={live?.id === place.item.id ? live : null}
          pose={poseOf(place.item.id)}
          selected={selectedId === place.item.id}
          eager={eager}
          onDown={onDown}
          onHide={onHide}
        />
      ))}

      {missingTop ? (
        <p className="pointer-events-none absolute top-[18%] left-1/2 -translate-x-1/2 text-[10px] tracking-wide text-neutral-400">
          Needs a top
        </p>
      ) : null}

      {empty ? null : selected ? (
        <div
          className="absolute top-2 right-2 z-40 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] tracking-wide text-neutral-600 shadow-sm hover:text-neutral-900"
            onClick={resetSelected}
          >
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LayeredMannequin({
  garments,
  className,
  compact,
}: {
  garments: Garment[];
  extras?: Extra[];
  className?: string;
  compact?: boolean;
}) {
  const { dress, bottom, feet, hat, rail, torso } = slotsOf(garments);
  const shorts = /short/i.test(bottom?.name ?? "");
  const empty = !torso && !bottom && !feet && !hat && rail.length === 0;
  const missingTop = !torso && Boolean(bottom || feet);
  const extrasWear = rail.filter((g) => g.category === "accessories");
  const bag = rail.find((g) => g.category === "bags");

  return (
    <div
      className={cn(
        "outfit-studio relative w-full overflow-hidden",
        compact ? "aspect-[4/5]" : "aspect-[3/4]",
        className,
      )}
      role="img"
      aria-label="Outfit"
    >
      {empty ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
          No pieces yet
        </p>
      ) : null}

      {hat ? (
        <Piece
          src={pieceSrc(hat)}
          name={hat.name}
          fit="absolute"
          className="top-[1%] left-1/2 z-[7] h-[12%] w-[36%] -translate-x-1/2"
        />
      ) : null}

      {bottom && !dress ? (
        <Piece
          src={pieceSrc(bottom)}
          name={bottom.name}
          fit="absolute"
          className={cn(
            "left-1/2 z-[2] w-[40%] -translate-x-1/2 object-top",
            shorts ? "top-[38%] h-[30%]" : "top-[28%] h-[54%]",
          )}
        />
      ) : null}

      {torso ? (
        <Piece
          src={pieceSrc(torso)}
          name={torso.name}
          fit="absolute"
          className={cn(
            "left-1/2 z-[4] -translate-x-1/2 object-top",
            dress ? "top-[3%] h-[80%] w-[64%]" : "top-[1%] h-[48%] w-[72%]",
          )}
        />
      ) : missingTop ? (
        <div
          className="absolute top-[6%] left-1/2 z-[1] flex h-[30%] w-[50%] -translate-x-1/2 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-[10px] tracking-wide text-neutral-400"
          aria-hidden
        >
          Needs a top
        </div>
      ) : null}

      {feet ? (
        <Piece
          src={pieceSrc(feet)}
          name={feet.name}
          fit="absolute"
          className={cn(
            "left-1/2 z-[5] w-[50%] -translate-x-1/2 object-center",
            shorts ? "top-[64%] h-[17%]" : "bottom-[1%] h-[16%]",
          )}
        />
      ) : null}
    </div>
  );
}

function OverlapLook({
  garments,
  extras,
  className,
  compact,
  eager,
  layoutKey,
}: {
  garments: Garment[];
  extras?: Extra[];
  className?: string;
  compact?: boolean;
  eager?: boolean;
  layoutKey?: string;
}) {
  const layout = useWardrobe((s) => s.profile.lookLayout) ?? "stacked";
  const canvasId = useId();
  const storedHidden = useWardrobe((s) =>
    layoutKey ? s.profile.pieceHidden?.[layoutKey] : undefined,
  );
  const storedPlaced = useWardrobe((s) =>
    layoutKey ? s.profile.piecePlaced?.[layoutKey] : undefined,
  );
  const storedPick = useWardrobe((s) =>
    layoutKey ? s.profile.torsoPick?.[layoutKey] : undefined,
  );
  const [localHidden, setLocalHidden] = useState<string[]>([]);
  const [localPlaced, setLocalPlaced] = useState<string[]>([]);
  const [localPick, setLocalPick] = useState<"outer" | "top">("outer");
  const hiddenIds = layoutKey ? (storedHidden ?? []) : localHidden;
  const hiddenSet = new Set(hiddenIds);
  const placedIds = layoutKey ? (storedPlaced ?? []) : localPlaced;
  const placedSet = new Set(placedIds);
  const visible = garments.filter((g) => !hiddenSet.has(g.id));
  const hidden = garments.filter((g) => hiddenSet.has(g.id));
  const layerOuter = visible.find((g) => g.category === "outerwear");
  const layerTop = visible.find((g) => g.category === "tops");
  const canSwap = Boolean(layerOuter && layerTop);
  const layerPick: "outer" | "top" =
    canSwap && (layoutKey ? storedPick : localPick) === "top" ? "top" : "outer";

  let worn = visible;
  if (canSwap && layerOuter && layerTop) {
    worn =
      layerPick === "outer"
        ? visible.filter((g) => g.id !== layerTop.id)
        : visible.filter((g) => g.id !== layerOuter.id);
  }

  const docked = worn.filter((g) => isTrayItem(g) && !placedSet.has(g.id));
  const onStudio = worn.filter((g) => !isTrayItem(g) || placedSet.has(g.id));

  function setHidden(ids: string[]) {
    if (layoutKey) {
      const all = { ...(useWardrobe.getState().profile.pieceHidden ?? {}) };
      useWardrobe.getState().setProfile({
        pieceHidden: { ...all, [layoutKey]: ids },
      });
    } else {
      setLocalHidden(ids);
    }
  }

  function setPlaced(ids: string[]) {
    if (layoutKey) {
      const all = { ...(useWardrobe.getState().profile.piecePlaced ?? {}) };
      useWardrobe.getState().setProfile({
        piecePlaced: { ...all, [layoutKey]: ids },
      });
    } else {
      setLocalPlaced(ids);
    }
  }

  function hidePiece(id: string) {
    const g = garments.find((x) => x.id === id);
    const ed = useLookEditor.getState();
    if (ed.pieceId === id) ed.select(canvasId, null);
    if (g && isTrayItem(g)) {
      setPlaced(placedIds.filter((x) => x !== id));
      return;
    }
    if (hiddenSet.has(id)) return;
    setHidden([...hiddenIds, id]);
  }

  function restorePiece(id: string) {
    setHidden(hiddenIds.filter((x) => x !== id));
  }

  function placePiece(id: string) {
    if (placedSet.has(id)) return;
    setPlaced([...placedIds, id]);
  }

  function setLayerPick(next: "outer" | "top") {
    if (layoutKey) {
      const all = { ...(useWardrobe.getState().profile.torsoPick ?? {}) };
      useWardrobe.getState().setProfile({
        torsoPick: { ...all, [layoutKey]: next },
      });
    } else {
      setLocalPick(next);
    }
  }

  const stage = {
    garments: onStudio,
    hidden,
    docked,
    className,
    canvasId,
    onHide: hidePiece,
    onRestore: restorePiece,
    onPlace: placePiece,
    layerOuter: canSwap ? layerOuter : undefined,
    layerTop: canSwap ? layerTop : undefined,
    layerPick: canSwap ? layerPick : undefined,
    onLayerPick: canSwap ? setLayerPick : undefined,
  };

  if (layout === "layered") {
    return (
      <OutfitStage {...stage}>
        <LayeredMannequin
          garments={onStudio.filter((g) => !isTrayItem(g))}
          extras={extras}
          compact={compact}
        />
      </OutfitStage>
    );
  }
  return (
    <OutfitStage {...stage}>
      <StackedMannequin
        garments={onStudio}
        extras={extras}
        compact={compact}
        eager={eager}
        layoutKey={layoutKey}
        canvasId={canvasId}
        onHide={hidePiece}
      />
    </OutfitStage>
  );
}

export const Mannequin = memo(function Mannequin({
  garments,
  extras,
  className,
  compact,
  eager,
  layoutKey,
}: {
  garments: Garment[];
  extras?: Extra[];
  className?: string;
  compact?: boolean;
  eager?: boolean;
  layoutKey?: string;
}) {
  return (
    <LookGrid
      garments={garments}
      className={className}
      compact={compact}
      eager={eager}
      layoutKey={layoutKey}
    />
  );
});

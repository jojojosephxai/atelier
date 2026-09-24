import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, startOfToday } from "date-fns";
import { Camera, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FittedPiece } from "@/components/fitted-piece";
import { NativeSelect } from "@/components/ui/field";
import { climateKit, isCampusJacket, isGymLayer, lookEligible, lookName, boardWhy } from "@/lib/board-set";
import { exportLookKitGrid, type KitExportResult } from "@/lib/kit-grid-export";
import { lookCardModel } from "@/lib/look-card";
import { whyForSet, whyPrimaryKey } from "@/lib/why-compose";
import { commitDislikeVotes, dislikeCombos } from "@/lib/dislike-confirm";
import { comboKey, lookCoreKey } from "@/lib/look";
import {
  closetSig,
  votePolarity,
  voteRecordKey,
} from "@/lib/look-votes";
import { usePieceSrc } from "@/lib/media";
import { briefFor, readyLooks } from "@/lib/morning";
import {
  CLIMATE_CHIPS,
  ROUTINES,
  currentSeason,
  daypart,
  defaultRoutine,
  weekdayLabel,
  type RoutineId,
} from "@/lib/routines";
import { useWardrobe } from "@/lib/store";
import type { Climate, Garment, SuggestedLook } from "@/lib/types";
import { CLIMATE_LABELS } from "@/lib/types";
import { cn, formatDay, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: StartPage });

const ORDER = [
  "outerwear",
  "tops",
  "dresses",
  "bottoms",
  "footwear",
  "accessories",
  "bags",
] as const;

function replayThumbPress(button: HTMLButtonElement) {
  button.classList.remove("is-pressing");
  void button.offsetWidth;
  button.classList.add("is-pressing");
}

function LookRemoveOverlay({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const busy = useRef(false);
  onCancelRef.current = onCancel;

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancelRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function confirm(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    if (busy.current) return;
    busy.current = true;
    onConfirm();
    window.setTimeout(() => {
      busy.current = false;
    }, 450);
  }

  return (
    <div
      className="look-kit-remove"
      role="dialog"
      aria-modal="true"
      aria-label="Remove this look"
    >
      <button
        type="button"
        className="look-kit-remove-scrim"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div className="look-kit-remove-copy">
        <p className="look-kit-remove-title">Remove</p>
        <button
          ref={confirmRef}
          type="button"
          className="look-kit-remove-confirm"
          onPointerDown={confirm}
          onClick={confirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function KitTile({ garment, label }: { garment: Garment; label: string }) {
  const src = usePieceSrc(garment);
  return (
    <article className="kit-tile min-w-0">
      <div className="outfit-studio relative w-full overflow-hidden">
        {src ? (
          <FittedPiece src={src} alt="" eager className="absolute inset-0" />
        ) : null}
      </div>
      <p className="kit-label">{label}</p>
    </article>
  );
}

function toastKitExport(result: KitExportResult) {
  switch (result) {
    case "downloaded":
      toast("Kit grid saved");
      break;
    case "shared":
      toast("Kit grid shared");
      break;
    case "cancelled":
      break;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function kitSlots(pieces: Garment[], routine: RoutineId) {
  const layer = pieces.find(isGymLayer);
  const outer = pieces.find((g) => g.category === "outerwear");
  const top =
    pieces.find((g) => g.category === "tops" && !isGymLayer(g)) ??
    pieces.find((g) => g.category === "dresses");
  const bottom = pieces.find((g) => g.category === "bottoms");
  const shoes = pieces.find((g) => g.category === "footwear");
  const bag = pieces.find((g) => g.category === "bags");
  return [
    layer || outer
      ? {
          label: routine === "gym" || layer ? "Layer" : "Outer",
          garment: (layer ?? outer)!,
        }
      : null,
    top
      ? {
          label: top.category === "dresses" ? "Dress" : "Top",
          garment: top,
        }
      : null,
    bottom ? { label: "Bottom", garment: bottom } : null,
    shoes ? { label: "Shoes", garment: shoes } : null,
    bag ? { label: "Bag", garment: bag } : null,
  ].filter((s): s is { label: string; garment: Garment } => Boolean(s));
}

function lookPieces(
  look: SuggestedLook,
  garments: Garment[],
  routine: RoutineId,
  climate: Climate,
): Garment[] {
  const raw = look.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => Boolean(g));
  const swapped = climateKit(raw, garments, routine, climate);
  const filled =
    swapped.length >= 2 ? swapped.slice(0, 5) : raw
    .filter((g) => {
      if (!lookEligible(g)) return false;
      if (routine === "gym") {
        if (isCampusJacket(g)) return false;
        if (/umbrella/i.test(g.name)) return false;
        if (g.category === "accessories" || g.category === "bags") return false;
        return (
          g.formality === "athletic" ||
          isGymLayer(g) ||
          (g.tags ?? []).some((t) => t.toLowerCase() === "gym")
        );
      }
      if (isGymLayer(g)) return false;
      return true;
    })
    .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))
    .filter((g) =>
      ["outerwear", "tops", "dresses", "bottoms", "footwear", "bags"].includes(
        g.category,
      ),
    )
    .slice(0, 5);
  if (routine === "school" && !filled.some((g) => g.category === "bags")) {
    const bag = garments.find(
      (g) => g.category === "bags" && lookEligible(g) && !isGymLayer(g),
    );
    if (bag) filled.push(bag);
  }
  return filled.slice(0, 5);
}

function StartPage() {
  const garments = useWardrobe((s) => s.garments);
  const extras = useWardrobe((s) => s.extras);
  const looks = useWardrobe((s) => s.looks);
  const storedClimate = useWardrobe((s) => s.profile.defaultClimate);
  const votes = useWardrobe((s) => s.profile.lookVotes);
  const lookRegen = useWardrobe((s) => s.profile.lookRegen ?? 0);
  const setProfile = useWardrobe((s) => s.setProfile);
  const wearToday = useWardrobe((s) => s.wearToday);
  const addLook = useWardrobe((s) => s.addLook);
  const updateLook = useWardrobe((s) => s.updateLook);
  const removeLook = useWardrobe((s) => s.removeLook);
  const wornLog = useWardrobe((s) => s.profile.wornLog);
  const [routine, setRoutine] = useState<RoutineId>(defaultRoutine);
  const [climateOverride, setClimateOverride] = useState<Climate | null>(null);
  const [shuffleAvoid, setShuffleAvoid] = useState<string[]>([]);
  const [blockKeys, setBlockKeys] = useState<string[]>([]);
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);
  const exportingKits = useRef(new Set<string>());
  const climate = climateOverride ?? storedClimate;
  const season = currentSeason();
  const scene = ROUTINES.find((r) => r.id === routine)!;
  const days = useMemo(() => {
    const start = startOfToday();
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(start, i), "yyyy-MM-dd"),
    );
  }, []);
  const brief = useMemo(
    () => briefFor(routine, climate, season),
    [routine, climate, season],
  );
  const suggestions = useMemo(
    () =>
      readyLooks(
        garments,
        extras,
        looks,
        brief,
        routine,
        shuffleAvoid,
        votes,
        blockKeys,
        lookRegen,
      ),
    [
      garments,
      extras,
      looks,
      brief,
      routine,
      shuffleAvoid,
      votes,
      blockKeys,
      lookRegen,
    ],
  );
  const kitsRaw = useMemo(
    () =>
      suggestions.map((look) =>
        lookPieces(look, garments, routine, climate),
      ),
    [suggestions, garments, routine, climate],
  );
  const kits = kitsRaw;
  const localWhys = useMemo(
    () =>
      whyForSet(kits, routine, climate).map(
        (line, i) => line || boardWhy(kits[i] ?? [], routine, climate),
      ),
    [kits, routine, climate],
  );

  function bumpRegen() {
    setProfile({ lookRegen: lookRegen + 1 });
  }

  function pickClimate(next: Climate) {
    setClimateOverride(next);
    setProfile({ defaultClimate: next, lookRegen: lookRegen + 1 });
    setShuffleAvoid([]);
    setBlockKeys([]);
  }

  function wear(pieces: Garment[], look: SuggestedLook) {
    wearToday({
      name: lookName(pieces, routine),
      garmentIds: pieces.map((g) => g.id),
      extraIds: [],
      occasion: scene.label,
      notes: look.rationale,
      source: look.source,
    });
    toast("That's today's look");
  }

  function castThumb(
    pieces: Garment[],
    next: 1 | -1,
    behavior: "toggle" | "commit",
  ) {
    const combo = comboKey(pieces.map((g) => g.id));
    const key = voteRecordKey(routine, climate, combo);
    const cur = { ...(votes ?? {}) };
    const entry = {
      garmentIdsSorted: combo,
      occasion: routine,
      climate,
      whyKey: whyPrimaryKey(pieces, routine, climate),
      vote: next,
      at: Date.now(),
      gen: lookRegen,
      closetSig: closetSig(garments),
    };
    switch (behavior) {
      case "toggle":
        if (votePolarity(cur[key]) === next) delete cur[key];
        else cur[key] = entry;
        break;
      case "commit":
        cur[key] = entry;
        break;
      default: {
        const unreachable: never = behavior;
        return unreachable;
      }
    }
    setProfile({ lookVotes: cur });
  }

  function savedFor(pieces: Garment[]) {
    const key = comboKey(pieces.map((g) => g.id));
    return looks.find((l) => comboKey(l.garmentIds) === key);
  }

  function ensureSaved(pieces: Garment[], look: SuggestedLook) {
    const hit = savedFor(pieces);
    if (hit) return hit.id;
    return addLook({
      name: lookName(pieces, routine),
      garmentIds: pieces.map((g) => g.id),
      extraIds: [],
      occasion: scene.label,
      notes: look.rationale,
      source: look.source,
    });
  }

  function onSchedule(pieces: Garment[], look: SuggestedLook, date: string) {
    const id = ensureSaved(pieces, look);
    updateLook(id, { plannedDate: date || undefined });
    if (!date && wearingKey === pieces.map((g) => g.id).join("|")) {
      setProfile({
        wornLog: (wornLog ?? []).filter((w) => w.date !== todayISO()),
      });
    }
  }

  function onRemoveCard(pieces: Garment[], look: SuggestedLook) {
    const hit = savedFor(pieces);
    if (hit) removeLook(hit.id);
    const core = lookCoreKey(look.garmentIds, garments);
    const combo = comboKey(pieces.map((g) => g.id));
    setBlockKeys((keys) => [...keys, core, combo].filter(Boolean));
  }

  async function onExportKit(grid: HTMLElement, name: string, key: string) {
    if (exportingKits.current.has(key)) return;
    exportingKits.current.add(key);
    try {
      const result = await exportLookKitGrid(grid, name);
      toastKitExport(result);
    } catch {
      toast("Could not export this kit");
    } finally {
      exportingKits.current.delete(key);
    }
  }

  const wearingKey = wornLog?.find((w) => w.date === todayISO())
    ?.garmentIds.join("|");

  return (
    <div className="today-page">
      <header className="today-head">
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          {daypart()} · {weekdayLabel()}
        </p>
        <h1 className="mt-1 font-display text-[2.35rem] leading-[0.92] text-fg italic sm:text-5xl md:text-6xl">
          What to wear
        </h1>
        <p className="mt-1 hidden max-w-xl text-sm leading-relaxed text-muted sm:block">
          {scene.blurb} Three outfits from this closet.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {ROUTINES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRoutine(r.id);
                setShuffleAvoid([]);
                setBlockKeys([]);
                bumpRegen();
              }}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm",
                routine === r.id
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
          {CLIMATE_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickClimate(c)}
              className={cn(
                "h-11 shrink-0 rounded-full px-3.5 text-sm",
                climate === c
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted",
              )}
            >
              {CLIMATE_LABELS[c]}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl leading-none text-fg italic sm:text-3xl md:text-4xl">
          {scene.label} looks
        </h2>
        <button
          type="button"
          className="h-11 text-sm text-muted hover:text-fg"
          onClick={() => {
            bumpRegen();
            setBlockKeys(
              suggestions
                .map((l) => lookCoreKey(l.garmentIds, garments))
                .filter(Boolean),
            );
            setShuffleAvoid(suggestions.flatMap((l) => l.garmentIds));
          }}
        >
          New set
        </button>
      </div>

      {suggestions.length ? (
        <div className="look-cols mt-3">
          {suggestions.map((look, i) => {
            const pieces = kits[i] ?? [];
            const saved = savedFor(pieces);
            const bound = lookCardModel(pieces, routine, saved?.photoDataUrl);
            const wearKey = pieces.map((g) => g.id).join("|");
            const why = localWhys[i] || "";
            const title = bound.title;
            const slots = kitSlots(
              bound.garmentIds
                .map((id) => pieces.find((g) => g.id === id))
                .filter((g): g is Garment => Boolean(g)),
              routine,
            );
            const wearing = wearingKey === wearKey;
            const cardKey = comboKey(pieces.map((g) => g.id));
            const voteKey = voteRecordKey(routine, climate, cardKey);
            const thumb = votePolarity(votes?.[voteKey]);
            const downPending = pendingRemoveKey === cardKey;
            return (
              <article
                key={`${comboKey(bound.garmentIds)}:${i}`}
                className="look-kit"
                data-look-body="kit"
              >
                <button
                  type="button"
                  aria-label="Remove look"
                  className="look-kit-dismiss"
                  onClick={() => onRemoveCard(pieces, look)}
                >
                  <X className="size-4" />
                </button>
                <h3 className="look-kit-title">
                  {title}
                </h3>
                {why ? (
                  <div className="why-band">
                    <p className="why-paper">{why}</p>
                  </div>
                ) : null}
                <div
                  className={cn("kit-grid", slots.length === 5 && "kit-grid-32")}
                  data-count={slots.length}
                >
                  {slots.length === 5 ? (
                    <>
                      <div className="kit-row kit-row-3">
                        {slots.slice(0, 3).map((slot) => (
                          <KitTile
                            key={slot.label}
                            garment={slot.garment}
                            label={slot.label}
                          />
                        ))}
                      </div>
                      <div className="kit-row kit-row-2">
                        {slots.slice(3).map((slot) => (
                          <KitTile
                            key={slot.label}
                            garment={slot.garment}
                            label={slot.label}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    slots.map((slot) => (
                      <KitTile
                        key={slot.label}
                        garment={slot.garment}
                        label={slot.label}
                      />
                    ))
                  )}
                </div>
                <div className="look-kit-actions">
                  <div className="look-kit-vote" role="group" aria-label="Private rating">
                    <button
                      type="button"
                      aria-label="Keep this look"
                      aria-pressed={thumb === 1 && !downPending}
                      onClick={(event) => {
                        replayThumbPress(event.currentTarget);
                        if (downPending) {
                          setPendingRemoveKey(null);
                          if (thumb !== 1) castThumb(pieces, 1, "commit");
                          return;
                        }
                        castThumb(pieces, 1, "toggle");
                      }}
                      className={cn(
                        "look-kit-thumb-up",
                        thumb === 1 && !downPending && "is-on",
                      )}
                    >
                      <ThumbsUp
                        className="size-4"
                        fill={thumb === 1 && !downPending ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Skip this look"
                      aria-pressed={downPending || thumb === -1}
                      onClick={(event) => {
                        replayThumbPress(event.currentTarget);
                        if (!cardKey) return;
                        setPendingRemoveKey(cardKey);
                      }}
                      className={cn(
                        "look-kit-thumb-down",
                        (downPending || thumb === -1) && "is-on",
                      )}
                    >
                      <ThumbsDown
                        className="size-4"
                        fill={downPending || thumb === -1 ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                  <div className="look-kit-schedule-wrap">
                    <NativeSelect
                      aria-label="Schedule"
                      className="look-kit-schedule"
                      value={saved?.plannedDate ?? ""}
                      onChange={(e) => onSchedule(pieces, look, e.target.value)}
                    >
                      <option value="">Unscheduled</option>
                      {days.map((iso) => (
                        <option key={iso} value={iso}>
                          {iso === todayISO() ? "Today" : formatDay(iso)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <button
                    type="button"
                    aria-label="Export kit grid"
                    className="look-kit-icon look-kit-photo"
                    onClick={(event) => {
                      const grid = event.currentTarget
                        .closest(".look-kit")
                        ?.querySelector(".kit-grid");
                      if (!(grid instanceof HTMLElement)) {
                        toast("Could not export this kit");
                        return;
                      }
                      void onExportKit(grid, title, wearKey);
                    }}
                  >
                    <Camera className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => wear(pieces, look)}
                  className={cn(
                    "look-kit-cta",
                    wearing
                      ? "bg-raised text-fg shadow-[var(--shadow-border)]"
                      : "bg-accent text-accent-fg",
                  )}
                >
                  {wearing ? "Wearing" : "Wear this"}
                </button>
                {downPending ? (
                  <LookRemoveOverlay
                    onCancel={() => setPendingRemoveKey(null)}
                    onConfirm={() => {
                      const shownIds = pieces.map((g) => g.id);
                      setProfile({
                        lookVotes: commitDislikeVotes(
                          votes,
                          dislikeCombos(shownIds, look.garmentIds),
                          {
                            occasion: routine,
                            climate,
                            whyKey: whyPrimaryKey(pieces, routine, climate),
                            at: Date.now(),
                            gen: lookRegen,
                            closetSig: closetSig(garments),
                          },
                        ),
                      });
                      onRemoveCard(pieces, look);
                      setPendingRemoveKey(null);
                    }}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Add a few pieces to the closet and looks will appear here.
        </p>
      )}
    </div>
  );
}

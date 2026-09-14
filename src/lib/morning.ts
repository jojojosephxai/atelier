import { composeLooks, suggestExtras } from "./engine";
import {
  comboKey,
  isCoat,
  isShorts,
  likedGarmentIds,
  lookCoreKey,
  lookIsWearable,
  piecesOf,
  skippedLookKeys,
} from "./look";
import {
  closetSig,
  isSuppressedLook,
  recentDowns,
  recentUps,
  thumbBonus,
} from "./look-votes";
import { boardLooks, lookFitsClimate, lookName } from "./board-set";
import { routineById, type RoutineId } from "./routines";
import type {
  Brief,
  Extra,
  Garment,
  Look,
  LookVoteMap,
  SuggestedLook,
  WornEntry,
} from "./types";

function coreKey(ids: string[], garments: Garment[]): string {
  return lookCoreKey(ids, garments);
}

export function lookFitsRoutine(look: Look, routine: RoutineId): boolean {
  const hay = `${look.occasion} ${look.name} ${look.notes}`.toLowerCase();
  if (routine === "school") return /\b(school|class|campus|hall)\b/.test(hay);
  if (routine === "weekend") return /\b(weekend|errand|saturday|sunday)\b/.test(hay);
  if (routine === "gym") return /\b(gym|pe|athletic|run|workout)\b/.test(hay);
  return /\b(out|dinner|date|evening|night)\b/.test(hay);
}

export function recentAvoidIds(log: WornEntry[] | undefined, days = 2): string[] {
  if (!log?.length) return [];
  const cutoff = Date.now() - days * 86_400_000;
  return log
    .filter((w) => {
      const [y, m, d] = w.date.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1).getTime() >= cutoff;
    })
    .flatMap((w) => w.garmentIds);
}

function asSuggested(look: Look): SuggestedLook {
  return {
    name: look.name,
    garmentIds: look.garmentIds,
    extraIds: look.extraIds,
    score: 80,
    rationale: look.notes,
    climateNotes: "",
    incomplete: [],
    source: look.source,
  };
}

export function readyLooks(
  garments: Garment[],
  extras: Extra[],
  looks: Look[],
  brief: Brief,
  routine: RoutineId,
  avoidIds: string[],
  votes?: LookVoteMap,
  blockKeys: string[] = [],
  regen = 0,
): SuggestedLook[] {
  const picked: SuggestedLook[] = [];
  const seen = new Set<string>(blockKeys.filter(Boolean));
  const sig = closetSig(garments);
  const downs = recentDowns(votes, routine, brief.climate, regen, sig);
  const ups = recentUps(votes, routine, brief.climate);
  const skip = new Set([
    ...skippedLookKeys(votes),
    ...downs.map((d) => d.garmentIdsSorted),
  ]);
  const liked = likedGarmentIds(votes);

  const decorate = (look: SuggestedLook): SuggestedLook => {
    const pieces = piecesOf(look.garmentIds, garments);
    const bonus = thumbBonus(pieces, ups, garments, routine, brief.climate);
    return bonus ? { ...look, score: look.score + bonus } : look;
  };

  const suppressed = (look: SuggestedLook) =>
    isSuppressedLook(
      look.garmentIds,
      piecesOf(look.garmentIds, garments),
      downs,
      routine,
      brief.climate,
    );

  const sensible = (look: SuggestedLook) => {
    if (!lookIsWearable(look, garments)) return false;
    const pieces = piecesOf(look.garmentIds, garments);
    if (pieces.some(isShorts) && pieces.some(isCoat)) return false;
    if (!lookFitsClimate(pieces, routine, brief.climate)) return false;
    const key = coreKey(look.garmentIds, garments);
    if (key && skip.has(key)) return false;
    if (skip.has(comboKey(look.garmentIds))) return false;
    return true;
  };

  const push = (look: SuggestedLook, allowSuppressed: boolean) => {
    const next = decorate(look);
    if (!sensible(next) && !allowSuppressed) return false;
    if (!allowSuppressed && suppressed(next)) return false;
    if (allowSuppressed && !lookIsWearable(next, garments)) return false;
    const key = coreKey(next.garmentIds, garments) || comboKey(next.garmentIds);
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    picked.push(next);
    return true;
  };

  const avoid = new Set(avoidIds);
  const preset = boardLooks(garments, routine, brief.climate);
  const kitExtras = suggestExtras(extras, brief).map((e) => e.id);
  const asKit = (kit: Garment[]): SuggestedLook => ({
    name: lookName(kit, routine),
    garmentIds: kit.map((g) => g.id),
    extraIds: kitExtras,
    score: 80,
    rationale: "",
    climateNotes: "",
    incomplete: [],
    source: "engine",
  });
  const takePreset = (allowSuppressed: boolean) => {
    for (const kit of preset) {
      if (picked.length >= 3) break;
      const look = decorate(asKit(kit));
      if (!allowSuppressed && suppressed(look)) continue;
      const key =
        coreKey(look.garmentIds, garments) || comboKey(look.garmentIds);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      picked.push(look);
    }
  };
  if (preset.length) takePreset(false);

  const saved = looks
    .filter((l) => lookFitsRoutine(l, routine))
    .map(asSuggested)
    .map(decorate)
    .sort((a, b) => b.score - a.score);
  for (const look of saved) {
    if (picked.length >= 3) break;
    const hits = look.garmentIds.filter((id) => avoid.has(id)).length;
    if (hits >= 1) continue;
    push(look, false);
  }

  if (picked.length < 3) {
    const extraAvoid = [...avoidIds, ...picked.flatMap((p) => p.garmentIds)];
    const first = composeLooks(garments, extras, brief, {
      avoidIds: extraAvoid,
      likedIds: liked,
      skipKeys: [...skip, ...seen],
    })
      .map(decorate)
      .sort((a, b) => b.score - a.score);
    for (const look of first) {
      if (picked.length >= 3) break;
      push(look, false);
    }
  }
  if (picked.length < 3) {
    for (const look of composeLooks(garments, extras, brief, {
      avoidIds: avoidIds,
      likedIds: liked,
      skipKeys: [...skip, ...seen],
    })
      .map(decorate)
      .sort((a, b) => b.score - a.score)) {
      if (picked.length >= 3) break;
      push(look, false);
    }
  }

  if (picked.length < 3 && preset.length) takePreset(true);

  return picked.slice(0, 3);
}

export function briefFor(
  routine: RoutineId,
  climate: Brief["climate"],
  season: Brief["season"],
): Brief {
  const r = routineById(routine);
  return {
    description: r.description,
    climate,
    occasion: r.occasion,
    season,
  };
}

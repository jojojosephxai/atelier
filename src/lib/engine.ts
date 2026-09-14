import { hexToHsl, isNeutralHex } from "./utils.ts";
import { comboKey, isCoat, isShorts, lookCoreKey } from "./look.ts";
import {
  isCampusJacket,
  isGymLayer,
  lookEligible,
  lookName,
} from "./board-set.ts";
import { whyLookWorks } from "./why.ts";
import type {
  Brief,
  Climate,
  Extra,
  Formality,
  Garment,
  GarmentCategory,
  Season,
  SuggestedLook,
} from "./types.ts";
import { FORMALITY_RANK } from "./types.ts";

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "at",
  "my",
  "me",
  "i",
  "im",
  "i'm",
  "need",
  "want",
  "something",
  "please",
  "just",
  "this",
  "that",
  "from",
  "into",
  "over",
  "out",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function climateScore(item: Climate[], target: Climate): number {
  if (item.includes(target)) return 22;
  const near: Record<Climate, Climate[]> = {
    hot: ["warm"],
    warm: ["hot", "mild"],
    mild: ["warm", "cool"],
    cool: ["mild", "cold"],
    cold: ["cool", "snow"],
    rain: ["cool", "mild", "cold"],
    snow: ["cold", "cool"],
  };
  if (near[target].some((c) => item.includes(c))) return 7;
  if (target === "rain" && item.includes("hot")) return -14;
  if (target === "hot" && (item.includes("cold") || item.includes("snow")))
    return -16;
  return -8;
}

function seasonScore(item: Season[], target: Season): number {
  if (item.includes("all") || item.includes(target)) return 12;
  if (target === "all") return 4;
  const order: Season[] = ["spring", "summer", "fall", "winter"];
  const ia = order.indexOf(item.find((s) => s !== "all") ?? "spring");
  const ib = order.indexOf(target);
  if (ia < 0 || ib < 0) return 0;
  const d = Math.min(Math.abs(ia - ib), 4 - Math.abs(ia - ib));
  return d === 1 ? 3 : -6;
}

function formalityScore(item: Formality, target: Formality): number {
  const d = Math.abs(FORMALITY_RANK[item] - FORMALITY_RANK[target]);
  if (d === 0) return 24;
  if (d === 1) return 11;
  if (d === 2) return 0;
  return -18;
}

function keywordScore(haystack: string, words: string[]): number {
  if (!words.length) return 0;
  const h = haystack.toLowerCase();
  let n = 0;
  for (const w of words) if (h.includes(w)) n += 1;
  return n * 7;
}

function vibeAdjust(g: Garment, desc: string): number {
  const d = desc.toLowerCase();
  let s = 0;
  const { l } = hexToHsl(g.hex);
  if (/\b(quiet|minimal|clean|simple|understated)\b/.test(d)) {
    s += isNeutralHex(g.hex) ? 8 : -5;
  }
  if (/\b(black|monochrome|all black)\b/.test(d) && l < 0.22) s += 10;
  if (/\b(navy)\b/.test(d) && g.colorName.toLowerCase().includes("navy")) s += 8;
  if (/\b(linen|airy|breathable)\b/.test(d) && /linen/i.test(g.material)) s += 10;
  if (/\b(sharp|tailored|boardroom|interview)\b/.test(d)) {
    s += FORMALITY_RANK[g.formality] >= 3 ? 8 : -4;
  }
  if (/\b(gym|run|train|workout|pe)\b/.test(d)) {
    const gymTagged = g.tags.some((t) => /gym/i.test(t));
    s += g.formality === "athletic" || gymTagged ? 14 : -10;
    if (isCampusJacket(g)) s -= 80;
    if (isGymLayer(g)) s += 8;
  }
  if (/\b(date|dinner|evening)\b/.test(d) && g.formality !== "athletic") s += 4;
  if (/\b(school|class|campus|hallway)\b/.test(d)) {
    s += g.formality === "casual" || g.formality === "smart-casual" ? 10 : 0;
    s += g.formality === "business" || g.formality === "formal" ? -16 : 0;
    s += g.formality === "athletic" ? -8 : 0;
    if (isGymLayer(g)) s -= 80;
    if (g.tags.some((t) => /school/i.test(t))) s += 12;
    if (/tee|jean|sneaker|chino|knit/i.test(g.name)) s += 8;
    if (/oxford shoe|dress shoe|tie|trouser/i.test(g.name)) s -= 10;
  }
  return s;
}

function itemText(g: Garment): string {
  return `${g.name} ${g.brand} ${g.material} ${g.notes} ${g.colorName} ${g.category} ${(g.tags ?? []).join(" ")}`;
}

function extraText(e: Extra): string {
  return `${e.name} ${e.brand} ${e.notes} ${e.kind} ${e.family ?? ""} ${(e.tags ?? []).join(" ")}`;
}

function scoreGarment(
  g: Garment,
  brief: Brief,
  words: string[],
  avoid: Set<string>,
  liked?: Set<string>,
): number {
  let s =
    climateScore(g.climate, brief.climate) +
    seasonScore(g.seasons, brief.season) +
    formalityScore(g.formality, brief.occasion) +
    keywordScore(itemText(g), words) +
    vibeAdjust(g, brief.description);
  if (avoid.has(g.id)) s -= 24;
  if (liked?.has(g.id)) s += 14;
  if (isShorts(g) && ["cool", "cold", "snow", "rain"].includes(brief.climate)) {
    s -= 36;
  }
  if (isCoat(g) && ["hot", "warm"].includes(brief.climate)) {
    s -= 36;
  }
  return s;
}

function paletteScore(hexes: string[]): number {
  const parts = hexes.map((hex) => ({
    hex,
    ...hexToHsl(hex),
    neutral: isNeutralHex(hex),
  }));
  const chroma = parts.filter((p) => !p.neutral);
  if (chroma.length <= 1) return 18;
  if (chroma.length === 2) {
    const d = hueDiff(chroma[0].h, chroma[1].h);
    if (d < 32) return 16;
    if (d < 58) return 10;
    if (d > 150 && d < 210) return 6;
    return 1;
  }
  const hues = chroma.map((c) => c.h).sort((a, b) => a - b);
  let span = 0;
  for (let i = 1; i < hues.length; i++) span = Math.max(span, hues[i] - hues[i - 1]);
  const wrap = 360 - (hues[hues.length - 1] - hues[0]);
  const cluster = Math.min(span, wrap);
  return cluster < 50 ? 9 : -10;
}

function wantsOuter(climate: Climate, desc: string): "required" | "nice" | "skip" {
  const d = desc.toLowerCase();
  if (/\b(indoors|inside|no coat|gym|run|train|workout|pe)\b/.test(d)) return "skip";
  if (climate === "cold" || climate === "snow" || climate === "rain") return "required";
  if (climate === "cool") return "nice";
  if (climate === "hot") return "skip";
  return "nice";
}

function pickBest(
  pool: Garment[],
  used: Set<string>,
  brief: Brief,
  words: string[],
  assembled: Garment[],
  avoid: Set<string>,
  liked?: Set<string>,
): Garment | undefined {
  let best: Garment | undefined;
  let bestScore = -40;
  for (const g of pool) {
    if (used.has(g.id)) continue;
    const s =
      scoreGarment(g, brief, words, avoid, liked) +
      paletteScore([...assembled, g].map((x) => x.hex));
    if (s > bestScore) {
      bestScore = s;
      best = g;
    }
  }
  return best;
}

function evening(desc: string): boolean {
  return /\b(evening|night|dinner|date|gala|cocktail)\b/.test(desc.toLowerCase());
}

/** Fragrance + skincare (+ grooming) picks for a brief. Used by compose and Today kits. */
export function suggestExtras(extras: Extra[], brief: Brief): Extra[] {
  return pickExtras(extras, brief, tokens(brief.description));
}

function pickExtras(
  extras: Extra[],
  brief: Brief,
  words: string[],
): Extra[] {
  const chosen: Extra[] = [];
  const frags = extras.filter((e) => e.kind === "fragrance");
  let bestFrag: Extra | undefined;
  let best = -20;
  for (const e of frags) {
    let s =
      climateScore(e.climate, brief.climate) +
      Math.max(...e.formality.map((f) => formalityScore(f, brief.occasion))) +
      keywordScore(extraText(e), words);
    if (e.family === "citrus" || e.family === "fresh") {
      if (brief.climate === "hot" || brief.climate === "warm") s += 8;
    }
    if (e.family === "woody" || e.family === "amber" || e.family === "leather") {
      if (brief.climate === "cool" || brief.climate === "cold") s += 8;
      if (brief.occasion === "formal" || brief.occasion === "business") s += 4;
    }
    if (s > best) {
      best = s;
      bestFrag = e;
    }
  }
  if (bestFrag) chosen.push(bestFrag);

  const night = evening(brief.description);
  const skin = extras
    .filter((e) => e.kind === "skincare")
    .filter((e) => {
      if (!e.slot || e.slot === "both") return true;
      return night ? e.slot === "pm" : e.slot === "am";
    })
    .sort((a, b) => (a.step ?? 99) - (b.step ?? 99));
  chosen.push(...skin);

  const groom = extras.filter((e) => e.kind === "grooming");
  if (groom.length) {
    const g =
      groom.find((x) => x.formality.includes(brief.occasion)) ?? groom[0];
    if (g) chosen.push(g);
  }
  return chosen;
}

function rationaleFor(
  pieces: Garment[],
  extras: Extra[],
  brief: Brief,
  incomplete: string[],
): { rationale: string; climateNotes: string; name: string } {
  const bottom = pieces.find((p) => p.category === "bottoms");
  const outer = pieces.find((p) => p.category === "outerwear");
  const scene = `${brief.occasion} ${brief.description}`.toLowerCase();
  const routine = /\b(gym|pe|athletic|workout|run)\b/.test(scene)
    ? "gym"
    : /\b(school|class|campus|hall)\b/.test(scene)
      ? "school"
      : /\b(out|dinner|date|evening|night)\b/.test(scene)
        ? "out"
        : "weekend";
  const name = lookName(pieces, routine as "gym" | "school" | "weekend" | "out");

  const parts: string[] = [];
  const why = whyLookWorks(
    pieces,
    extras,
    `${brief.occasion} ${brief.description}`,
    brief.climate,
  );
  if (why) parts.push(why);
  if (incomplete.length) {
    parts.push(`Gaps: ${incomplete.join("; ")}.`);
  }

  let climateNotes = "";
  if (brief.climate === "rain") {
    climateNotes = outer
      ? "Keep the outer layer on between doors. Suede stays home."
      : "You will get wet — add a rain-ready coat when you can.";
  } else if (brief.climate === "hot") {
    climateNotes = "Skip extra layers. Linen and open collars beat structure.";
  } else if (brief.climate === "cold" || brief.climate === "snow") {
    climateNotes = outer
      ? "Coat on for the walk; peel it indoors."
      : "This closet is light for the temperature — add a proper coat.";
  } else if (brief.climate === "cool") {
    climateNotes = "A single layer is enough if you keep moving.";
  } else {
    climateNotes = "Mild air — dress for the room, not the street.";
  }

  return {
    name: name || "Composed look",
    rationale: parts.join(" "),
    climateNotes,
  };
}

export type ComposeOpts = {
  avoidIds?: string[];
  likedIds?: string[];
  skipKeys?: string[];
};

export function composeLooks(
  garments: Garment[],
  extras: Extra[],
  brief: Brief,
  opts?: ComposeOpts,
): SuggestedLook[] {
  const worn = new Set(opts?.avoidIds ?? []);
  const liked = new Set(opts?.likedIds ?? []);
  const skip = new Set(opts?.skipKeys ?? []);
  const banned = new Set<string>();
  const usedExtras = new Set<string>();
  const words = tokens(brief.description);
  const picked: SuggestedLook[] = [];

  for (let n = 0; n < 8 && picked.length < 3; n++) {
    const look = composeOne(
      garments,
      extras,
      brief,
      words,
      banned,
      worn,
      liked,
      skip,
      usedExtras,
      !picked.some((l) =>
        l.garmentIds.some(
          (id) => garments.find((g) => g.id === id)?.category === "bags",
        ),
      ),
    );
    if (!look) continue;
    picked.push(look);
    for (const id of look.extraIds) usedExtras.add(id);
    const gymOn =
      brief.occasion === "athletic" ||
      /\b(gym|pe|workout)\b/.test(brief.description.toLowerCase());
    for (const id of look.garmentIds) {
      const g = garments.find((x) => x.id === id);
      if (
        gymOn &&
        g &&
        (g.category === "bottoms" || g.category === "footwear")
      ) {
        continue;
      }
      banned.add(id);
    }
  }

  return picked;
}

function composeOne(
  garments: Garment[],
  extrasFor: Extra[],
  brief: Brief,
  words: string[],
  banned: Set<string>,
  worn: Set<string>,
  liked: Set<string>,
  skip: Set<string>,
  usedExtras: Set<string>,
  allowBag: boolean,
): SuggestedLook | undefined {
  const gymOn =
    brief.occasion === "athletic" ||
    /\b(gym|pe|workout)\b/.test(brief.description.toLowerCase());
  const open = (cat: GarmentCategory) =>
    garments.filter((g) => {
      if (!lookEligible(g) || g.category !== cat || banned.has(g.id)) {
        return false;
      }
      if (gymOn) {
        if (isCampusJacket(g)) return false;
        if (g.category === "outerwear") return false;
        if (isGymLayer(g)) return cat === "tops";
        return (
          g.formality === "athletic" ||
          (g.tags ?? []).some((t) => t.toLowerCase() === "gym")
        );
      }
      if (isGymLayer(g)) return false;
      return true;
    });

  const tops = open("tops")
    .filter((g) => !gymOn || !isGymLayer(g))
    .map((g) => ({ g, s: scoreGarment(g, brief, words, worn, liked) }))
    .sort((a, b) => b.s - a.s);
  const bottoms = open("bottoms")
    .map((g) => ({ g, s: scoreGarment(g, brief, words, worn, liked) }))
    .sort((a, b) => b.s - a.s);
  const dresses = open("dresses")
    .map((g) => ({ g, s: scoreGarment(g, brief, words, worn, liked) }))
    .sort((a, b) => b.s - a.s);

  let core: Garment[] | undefined;
  let best = -80;

  for (const d of dresses.slice(0, 4)) {
    if (d.s > best) {
      best = d.s;
      core = [d.g];
    }
  }

  for (const top of tops.slice(0, 8)) {
    for (const bottom of bottoms.slice(0, 6)) {
      const gap = Math.abs(
        FORMALITY_RANK[top.g.formality] - FORMALITY_RANK[bottom.g.formality],
      );
      if (gap > 2) continue;
      const s =
        top.s +
        bottom.s +
        paletteScore([top.g.hex, bottom.g.hex]);
      if (s > best) {
        best = s;
        core = [top.g, bottom.g];
      }
    }
  }

  if (!core) return undefined;

  const used = new Set(core.map((g) => g.id));
  const assembled = [...core];
  const outerNeed = gymOn ? "skip" : wantsOuter(brief.climate, brief.description);
  const shortsOn = assembled.some(isShorts);

  if (outerNeed !== "skip") {
    const outerPool = open("outerwear").filter(
      (g) => !(shortsOn && isCoat(g)) && !isCampusJacket(g),
    );
    const outer = pickBest(
      outerPool,
      used,
      brief,
      words,
      assembled,
      worn,
      liked,
    );
    if (outer && !(shortsOn && isCoat(outer))) {
      assembled.push(outer);
      used.add(outer.id);
    }
  }

  if (
    gymOn &&
    ["cool", "cold", "snow", "rain"].includes(brief.climate)
  ) {
    const layer = pickBest(
      garments.filter(
        (g) =>
          lookEligible(g) &&
          isGymLayer(g) &&
          !isCampusJacket(g) &&
          !banned.has(g.id) &&
          !used.has(g.id),
      ),
      used,
      brief,
      words,
      assembled,
      worn,
      liked,
    );
    if (layer) {
      assembled.push(layer);
      used.add(layer.id);
    }
  }

  const feet = pickBest(
    open("footwear"),
    used,
    brief,
    words,
    assembled,
    worn,
    liked,
  );
  if (feet) {
    assembled.push(feet);
    used.add(feet.id);
  }

  if (!gymOn) {
    const rainOn = brief.climate === "rain";
    const accPool = open("accessories").filter((g) => {
      const isUmbrella = /umbrella/i.test(g.name);
      return rainOn ? true : !isUmbrella;
    });
    const umbrella = rainOn
      ? accPool.find((g) => /umbrella/i.test(g.name))
      : undefined;
    const acc =
      umbrella ??
      pickBest(accPool, used, brief, words, assembled, worn, liked);
    if (acc) {
      assembled.push(acc);
      used.add(acc.id);
    }
  }

  if (
    allowBag &&
    (brief.occasion === "business" ||
      brief.occasion === "formal" ||
      /\b(travel|work|office|bag|backpack|tote|school|class|campus)\b/.test(
        brief.description.toLowerCase(),
      ))
  ) {
    const bag = pickBest(
      open("bags"),
      used,
      brief,
      words,
      assembled,
      worn,
      liked,
    );
    if (bag) assembled.push(bag);
  }

  if (
    skip.has(lookCoreKey(assembled.map((g) => g.id), garments)) ||
    skip.has(comboKey(assembled.map((g) => g.id)))
  ) {
    for (const g of assembled) {
      if (g.category === "tops" || g.category === "bottoms" || g.category === "dresses") {
        banned.add(g.id);
      }
    }
    return undefined;
  }

  const hasFeet = assembled.some((p) => p.category === "footwear");
  const hasBody =
    assembled.some((p) => p.category === "dresses") ||
    (assembled.some((p) => p.category === "tops") &&
      assembled.some((p) => p.category === "bottoms"));
  const hasOuter = assembled.some((p) => p.category === "outerwear");
  const incomplete: string[] = [];
  if (!hasBody) return undefined;
  if (!hasFeet) incomplete.push("No footwear that fits this brief");
  if (outerNeed === "required" && !hasOuter) {
    incomplete.push("No outerwear for this climate");
  }

  let score = assembled.reduce(
    (n, g) => n + scoreGarment(g, brief, words, worn, liked),
    0,
  );
  score += paletteScore(assembled.map((p) => p.hex));
  if (!hasFeet) score -= 30;
  if (!hasBody) score -= 28;
  if (outerNeed === "required" && !hasOuter) score -= 24;
  if (outerNeed === "skip" && hasOuter) score -= 12;
  if (shortsOn && assembled.some(isCoat)) score -= 80;

  const chosenExtras = pickExtras(
    extrasFor.filter((e) => !usedExtras.has(e.id) || e.kind === "skincare"),
    brief,
    words,
  );
  const copy = rationaleFor(assembled, chosenExtras, brief, incomplete);
  return {
    name: copy.name,
    garmentIds: assembled.map((p) => p.id),
    extraIds: chosenExtras.map((e) => e.id),
    score,
    rationale: copy.rationale,
    climateNotes: copy.climateNotes,
    incomplete,
    source: "engine",
  };
}


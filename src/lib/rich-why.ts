import type { RoutineId } from "./routines.ts";
import { FORMALITY_RANK, type Climate, type Garment } from "./types.ts";

/** Insight angle — three Today cards must use three different architectures. */
export type WhyInsight = "tonal" | "accent" | "texture" | "silhouette";

export const WHY_INSIGHTS: WhyInsight[] = [
  "tonal",
  "accent",
  "texture",
  "silhouette",
];

/** Phrases and shells that read as design-system jargon, not fashion copy. */
const JARGON =
  /\b(value contrast|loud break|texture break|mute (?:value )?shift|supporting breaks|as the ground|frames a softer|sharper outer|softer body|one mute register|depthRead|psychologically|comfortable|casual|good for school|calm and composed|easy and composed|sleek and confident|clean and fresh|natural and calm|understated|warm and approachable|grounded and warm|stylish and versatile|perfect for any|looks great together|wet-weather|mild day|umbrella|AC[-\s]?shell|cold gym layer)\b/i;

/** Forced diagnostic templates — ban entirely. */
const FORBIDDEN_SHELL =
  /\b\w+\s+against\s+[\w\s]+\bis (?:the |a )?(?:value |texture |mute |loud |soft )?(?:contrast|break)\b/i;

const FIT_RE =
  /\b(relaxed|oversized|fitted|straight(?:-leg)?|slim|cropped|tailored|loose|boxy|skinny|wide(?:-leg)?|knee[- ]length|baggy|flared|bootcut|taper(?:ed)?|boyfriend)\b/i;

const GARMENT_WORD =
  /\b(jacket|coat|shell|hoodie|zip|tee|shirt|knit|crew|polo|jeans?|chinos?|trousers|joggers?|shorts?|sneakers?|trainers?|boots?|shoes|cargos?|skirt|blazer|parka|sweater)\b/i;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function isNeutralHex(hex: string): boolean {
  const { h, s, l } = hexToHsl(hex);
  if (s < 0.12) return true;
  if (l < 0.12 || l > 0.9) return true;
  if (h >= 200 && h <= 250 && s < 0.45 && l < 0.38) return true;
  if ((h <= 40 || h >= 30) && h < 50 && s < 0.35 && l < 0.45) return true;
  return false;
}

function isGymLayer(g: Garment): boolean {
  return /hoodie|quarter[-\s]?zip/i.test(`${g.name} ${g.notes}`);
}

function asRoutine(occasion: string): RoutineId {
  const o = occasion.toLowerCase();
  if (o === "school" || /\bschool\b/.test(o)) return "school";
  if (o === "gym" || /\bgym\b/.test(o)) return "gym";
  if (o === "weekend" || /\bweekend\b/.test(o)) return "weekend";
  if (o === "out" || /\bout\b/.test(o)) return "out";
  return "school";
}

function outerOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "outerwear" && !isGymLayer(g));
}
function topOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "tops" && !isGymLayer(g));
}
function bottomOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "bottoms");
}
function layerOf(pieces: Garment[]) {
  return pieces.find(isGymLayer);
}
function shoesOf(pieces: Garment[]) {
  return pieces.find((g) => g.category === "footwear");
}

/** Short role noun — never the full title pair. */
function roleNoun(g: Garment): string {
  const n = `${g.name} ${g.notes}`.toLowerCase();
  if (/rain\s*shell|\bshell\b/.test(n)) return "shell";
  if (/harrington|denim\s*jacket|field\s*jacket/.test(n)) return "jacket";
  if (/hoodie/.test(n)) return "fleece";
  if (/quarter[-\s]?zip/.test(n)) return "zip layer";
  if (/polo/.test(n)) return "knit";
  if (/merino|crew/.test(n)) return "crew";
  if (/\btee\b|t-shirt/.test(n)) return "tee";
  if (/oxford|shirt/.test(n)) return "shirt";
  if (/jean/.test(n)) return "jeans";
  if (/chino/.test(n)) return "chinos";
  if (/jogger/.test(n)) return "joggers";
  if (/trouser|pant/.test(n)) return "trousers";
  if (/short/.test(n) && g.category === "bottoms") return "shorts";
  if (/trainer|sneaker/.test(n)) return "sneakers";
  if (/loafer|derby|boot/.test(n)) return "shoes";
  if (g.category === "outerwear") return "jacket";
  if (g.category === "tops") return "top";
  if (g.category === "bottoms") return "bottom";
  if (g.category === "footwear") return "shoes";
  return g.name.split(/\s+/).slice(-1)[0]!.toLowerCase();
}

function colorOf(g: Garment): string {
  return (g.colorName || "").trim();
}

/** Material only from the garment field — never invent from appearance. */
function matOf(g: Garment): string {
  return (g.material || "").trim();
}

function hueSpan(a: Garment, b: Garment): number {
  const d = Math.abs(hexToHsl(a.hex).h - hexToHsl(b.hex).h);
  return d > 180 ? 360 - d : d;
}

function sameFamily(a: Garment, b: Garment): boolean {
  const ca = colorOf(a).toLowerCase();
  const cb = colorOf(b).toLowerCase();
  if (ca && cb && ca === cb) return true;
  const la = hexToHsl(a.hex).l;
  const lb = hexToHsl(b.hex).l;
  if (ca && cb && ca !== cb && isNeutralHex(a.hex) && isNeutralHex(b.hex)) {
    return Math.abs(la - lb) < 0.12;
  }
  return hueSpan(a, b) < 28 && Math.abs(la - lb) < 0.2;
}

function lightOf(g: Garment): number {
  return hexToHsl(g.hex).l;
}

function isLight(g: Garment): boolean {
  return lightOf(g) > 0.72 || /white|ivory|cream|sand|beige/i.test(colorOf(g));
}

function isDark(g: Garment): boolean {
  return lightOf(g) < 0.28 || /navy|black|charcoal|indigo/i.test(colorOf(g));
}

function fitOf(pieces: Garment[]): string {
  for (const g of pieces) {
    const m = `${g.name} ${g.notes}`.match(FIT_RE);
    if (m?.[1]) {
      return m[1]
        .toLowerCase()
        .replace("straight-leg", "straight")
        .replace("knee length", "knee-length");
    }
  }
  return "";
}

function endSentence(clause: string): string {
  let t = clause.trim().replace(/[.!?]+$/, "");
  if (!t) return "";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return `${t}.`;
}

function scrub(line: string): string {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t || JARGON.test(t) || FORBIDDEN_SHELL.test(t)) return "";
  if (/is the wet-weather|even on a mild/i.test(t)) return "";
  if (
    /navy rain shell|navy polo knit|navy harrington|black merino crew|indigo denim jacket|ivory linen shirt/i.test(
      t,
    )
  ) {
    return "";
  }
  if (/\b(harrington|hoodie|rain shell) over\b/i.test(t)) return "";
  return t;
}

/** Overall palette feel — only when the kit earns it. */
function paletteFeel(pieces: Garment[]): string {
  const colors = pieces.map(colorOf).filter(Boolean).map((c) => c.toLowerCase());
  const hasOlive = colors.some((c) => /olive|forest|khaki|green/.test(c));
  const neutrals = pieces.filter((g) => isNeutralHex(g.hex));
  const lights = pieces.filter(isLight);
  const darks = pieces.filter(isDark);
  if (hasOlive && neutrals.length >= 2) return "earthy and muted";
  if (darks.length >= 2 && lights.length === 0) return "tonal and closed";
  if (lights.length >= 1 && darks.length >= 1 && neutrals.length >= 2) {
    return "quiet contrast, still muted";
  }
  if (neutrals.length === pieces.filter((g) => colorOf(g)).length) {
    return "muted throughout";
  }
  return "";
}

function coloredRole(g: Garment): string {
  const c = colorOf(g);
  const role = roleNoun(g);
  return c ? `${c.toLowerCase()} ${role}` : role;
}

/**
 * Palette sentence — architecture keyed by insight so Today cards do not share a shell.
 * Order preference: what you see first → what contrasts → what ties it together.
 */
function paletteSentence(
  pieces: Garment[],
  insight: WhyInsight,
  climate: Climate,
): string {
  const outer = outerOf(pieces) ?? layerOf(pieces);
  const top = topOf(pieces);
  const bottom = bottomOf(pieces);
  const shoes = shoesOf(pieces);
  const layer = layerOf(pieces);
  const feel = paletteFeel(pieces);

  // --- accent: open on the break piece ---
  if (insight === "accent") {
    if (shoes && colorOf(shoes) && (outer || top)) {
      const upper = outer && top && sameFamily(outer, top)
        ? `${colorOf(outer || top!).toLowerCase()} through the ${roleNoun(outer ?? top!)}${top && outer ? ` and ${roleNoun(top)}` : ""}`
        : outer && top
          ? `${coloredRole(outer)} over ${coloredRole(top)}`
          : coloredRole(outer ?? top!);
      const low = bottom
        ? `, then ${coloredRole(bottom)} below`
        : "";
      return scrub(
        `${colorOf(shoes)} at the ${roleNoun(shoes)} lifts the line after ${upper}${low}`,
      );
    }
    if (bottom && top && !sameFamily(top, bottom)) {
      return scrub(
        `${coloredRole(bottom)} break the quieter ${colorOf(top).toLowerCase() || "upper"} stack and keep the eye moving down`,
      );
    }
  }

  // --- silhouette: open on vertical color mass / proportion of color ---
  if (insight === "silhouette") {
    if (outer && top && bottom) {
      if (isDark(outer) && isLight(top)) {
        return scrub(
          `Dark weight sits in the ${roleNoun(outer)}, ${colorOf(top).toLowerCase()} lightens the middle, and ${coloredRole(bottom)} hold the lower half`,
        );
      }
      if (sameFamily(outer, top)) {
        return scrub(
          `Most of the mass stays ${colorOf(outer).toLowerCase()} up top, with ${coloredRole(bottom)} carrying the lower half`,
        );
      }
      return scrub(
        `Color stacks ${colorOf(outer).toLowerCase()} outside, ${colorOf(top).toLowerCase()} through the ${roleNoun(top)}, ${colorOf(bottom).toLowerCase()} below`,
      );
    }
    if (layer && top && bottom) {
      return scrub(
        `Volume and ${colorOf(layer).toLowerCase()} sit up top, then ${coloredRole(bottom)} clean the lower half`,
      );
    }
  }

  // --- texture: open on what the eye hits first (often the light plane) ---
  if (insight === "texture") {
    if (outer && top && isLight(top) && isDark(outer)) {
      const verb = bottom && /s$/.test(roleNoun(bottom)) ? "keep" : "keeps";
      const bottomBit = bottom
        ? `; ${coloredRole(bottom)} ${verb} the lower half steadier`
        : "";
      return scrub(
        `${colorOf(top)} in the ${roleNoun(top)} opens under the ${coloredRole(outer)}${bottomBit}`,
      );
    }
    if (outer && top && !sameFamily(outer, top)) {
      const tie = feel ? ` — ${feel}` : "";
      return scrub(
        `You see ${coloredRole(outer)} first, then ${coloredRole(top)} inside${bottom ? `, tied by ${coloredRole(bottom)}` : ""}${tie}`,
      );
    }
    if (top && bottom) {
      return scrub(
        `${coloredRole(top)} meets ${coloredRole(bottom)} — ${feel || "related tones, not a costume break"}`,
      );
    }
  }

  // --- tonal (default): continuous field, then the shift ---
  if (outer && top && sameFamily(outer, top)) {
    const c = colorOf(outer) || colorOf(top);
    if (bottom && !sameFamily(top, bottom)) {
      const shoeBit =
        shoes && colorOf(shoes) && !sameFamily(top, shoes)
          ? `, ${colorOf(shoes).toLowerCase()} finishing at the ${roleNoun(shoes)}`
          : "";
      return scrub(
        `${c} runs through the ${roleNoun(outer)} and ${roleNoun(top)}, then ${coloredRole(bottom)} take the lower half${shoeBit}`,
      );
    }
    return scrub(
      `${c} holds the ${roleNoun(outer)} and ${roleNoun(top)} in one quiet field${
        bottom ? `, continued by ${coloredRole(bottom)}` : ""
      }${feel ? ` — ${feel}` : ""}`,
    );
  }

  if (outer && top) {
    const oc = colorOf(outer);
    const tc = colorOf(top);
    if (oc && tc && oc.toLowerCase() !== tc.toLowerCase()) {
      if (isLight(top) && isDark(outer)) {
        return scrub(
          `${oc} holds the ${roleNoun(outer)} while ${tc.toLowerCase()} opens through the ${roleNoun(top)}${
            bottom
              ? `, and ${coloredRole(bottom)} quiet the lower half`
              : ""
          }${feel ? ` — ${feel}` : ""}`,
        );
      }
      return scrub(
        `${coloredRole(outer)} and ${coloredRole(top)} sit in different values${
          bottom ? `, with ${coloredRole(bottom)} steadying the lower half` : ""
        }${feel ? ` — ${feel}` : ""}`,
      );
    }
  }

  if (layer && top) {
    const lc = colorOf(layer);
    const tc = colorOf(top);
    if (lc && tc && sameFamily(layer, top)) {
      return scrub(
        `${lc} stays continuous through the ${roleNoun(layer)} and ${roleNoun(top)} — one field, not a costume change`,
      );
    }
    if (lc && tc) {
      return scrub(
        `${coloredRole(layer)} over ${coloredRole(top)} keeps the upper half simple${
          bottom ? `, then ${coloredRole(bottom)} finish below` : ""
        }`,
      );
    }
  }

  if (top && bottom) {
    const tc = colorOf(top);
    const bc = colorOf(bottom);
    if (tc && bc && sameFamily(top, bottom)) {
      return scrub(
        `${tc} carries from the ${roleNoun(top)} into the ${roleNoun(bottom)} without jumping`,
      );
    }
    if (tc && bc) {
      return scrub(
        `${coloredRole(top)} lands on ${coloredRole(bottom)}${
          feel ? ` — ${feel}` : ""
        }`,
      );
    }
  }

  if (climate === "rain" && outer) {
    const c = colorOf(outer) || (top ? colorOf(top) : "navy");
    return scrub(
      `${c} stays continuous through the ${roleNoun(outer)}${
        top ? ` and ${roleNoun(top)}` : ""
      }`,
    );
  }

  const colors = pieces
    .map(colorOf)
    .filter(Boolean)
    .filter(
      (c, i, a) => a.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i,
    )
    .slice(0, 2);
  if (colors.length === 2) {
    return scrub(
      `${colors[0]} and ${colors[1]!.toLowerCase()} share the kit without fighting${
        feel ? ` — ${feel}` : ""
      }`,
    );
  }
  if (colors.length === 1) {
    return scrub(`${colors[0]} holds most of what you see`);
  }
  return scrub("The colors stay related across the kit");
}

/**
 * Structure sentence — second architecture keyed by insight.
 * Materials named only when both garments have material fields.
 */
function structureSentence(
  pieces: Garment[],
  insight: WhyInsight,
  routine: RoutineId,
  climate: Climate,
): string {
  const outer = outerOf(pieces);
  const top = topOf(pieces);
  const bottom = bottomOf(pieces);
  const layer = layerOf(pieces);
  const shoes = shoesOf(pieces);
  const sil = fitOf(pieces);

  const matsDiffer = (a: Garment, b: Garment) => {
    const ma = matOf(a);
    const mb = matOf(b);
    return Boolean(ma && mb && ma.toLowerCase() !== mb.toLowerCase());
  };

  // --- silhouette insight: fit / volume leads ---
  if (insight === "silhouette") {
    if (sil && outer && top) {
      return scrub(
        `${sil.charAt(0).toUpperCase()}${sil.slice(1)} cut through the ${roleNoun(outer)} leaves room so the ${roleNoun(top)} can hang without fighting the outer line`,
      );
    }
    if (sil && bottom) {
      return scrub(
        `${sil.charAt(0).toUpperCase()}${sil.slice(1)} ${roleNoun(bottom)} keep the proportion steady so the upper half can stay easier`,
      );
    }
    if (layer && bottom) {
      const oversized =
        sil === "oversized" || /oversized/i.test(`${layer.name} ${layer.notes}`);
      if (oversized) {
        return scrub(
          `Oversized fleece adds volume up top so the ${roleNoun(bottom)} can stay closer and athletic underneath`,
        );
      }
    }
  }

  // --- texture insight: hand / fabric when data supports it ---
  if (insight === "texture") {
    if (outer && top && matsDiffer(outer, top)) {
      if (climate === "rain") {
        return scrub(
          `${matOf(outer)} in the ${roleNoun(outer)} stays crisp over ${matOf(top).toLowerCase()} in rain`,
        );
      }
      return scrub(
        `${matOf(outer)} in the ${roleNoun(outer)} reads firmer than ${matOf(top).toLowerCase()} in the ${roleNoun(top)}, so structure sits outside and ease stays through the middle`,
      );
    }
    if (top && bottom && matsDiffer(top, bottom)) {
      return scrub(
        `${matOf(top)} in the ${roleNoun(top)} and ${matOf(bottom).toLowerCase()} in the ${roleNoun(bottom)} keep the halves related without matching`,
      );
    }
    // No material data: talk structure without inventing fabric names
    if (outer && top) {
      return scrub(
        `The ${roleNoun(outer)} holds a cleaner outer line while the ${roleNoun(top)} stays easier underneath`,
      );
    }
  }

  // --- accent insight: how the line finishes ---
  if (insight === "accent") {
    if (shoes && bottom) {
      return scrub(
        `${roleNoun(bottom).charAt(0).toUpperCase()}${roleNoun(bottom).slice(1)} keep the hang clean so the ${roleNoun(shoes)} read as the finish, not a second story`,
      );
    }
    if (shoes) {
      return scrub(
        `The ${roleNoun(shoes)} close the outline after the upper stack does the quieter work`,
      );
    }
    if (bottom && top) {
      return scrub(
        `The ${roleNoun(bottom)} finish the proportion so the ${roleNoun(top)} does not have to carry the whole look`,
      );
    }
  }

  // --- tonal (default): continuity of hang / slight psychology ---
  if (outer && top) {
    if (matsDiffer(outer, top)) {
      return scrub(
        `${matOf(outer)} outside and ${matOf(top).toLowerCase()} inside keep the stack layered — firmer face, easier hang underneath`,
      );
    }
    if (sil) {
      return scrub(
        `${sil.charAt(0).toUpperCase()}${sil.slice(1)} proportion links the ${roleNoun(outer)} to the ${roleNoun(top)} so the hang reads as one kit`,
      );
    }
    return scrub(
      `The ${roleNoun(outer)} sets the outer outline and the ${roleNoun(top)} stays secondary underneath rather than competing`,
    );
  }

  if (layer) {
    const oversized =
      sil === "oversized" || /oversized/i.test(`${layer.name} ${layer.notes}`);
    if (oversized && bottom) {
      return scrub(
        `Oversized fleece adds volume up top so the ${roleNoun(bottom)} keep a cleaner athletic hang underneath`,
      );
    }
    if (bottom) {
      return scrub(
        `The ${roleNoun(layer)} softens the upper half while the ${roleNoun(bottom)} finish the athletic outline`,
      );
    }
    return scrub(
      `Fleece volume up top keeps the kit ready to move rather than going tight`,
    );
  }

  if (top && bottom) {
    if (matsDiffer(top, bottom)) {
      return scrub(
        `${matOf(top)} and ${matOf(bottom).toLowerCase()} hang as related halves rather than a matched set`,
      );
    }
    if (sil) {
      return scrub(
        `${sil.charAt(0).toUpperCase()}${sil.slice(1)} cut links both halves so the outline reads as one hang`,
      );
    }
    if (routine === "gym") {
      return scrub(
        `Athletic cut through the line keeps the kit ready to move rather than to pose`,
      );
    }
    return scrub(
      `Proportions link both halves so the outline hangs as one rather than two separate pieces`,
    );
  }

  if (outer) {
    return scrub(
      `The ${roleNoun(outer)} sets the outer outline so everything under it stays secondary`,
    );
  }
  return scrub("The hang reads stacked rather than flat");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clampWords(text: string, max = 50): string {
  let t = text.replace(/\s+/g, " ").trim();
  const found = t.match(/[^.!?]+[.!?]+/g) ?? [t];
  t = found.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > max) {
    t = `${words.slice(0, max).join(" ").replace(/[.,;:—-]+$/, "")}.`;
  }
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

/** First few words — used to detect identical sentence shells across a set. */
export function whyOpeningFingerprint(line: string): string {
  const first = (line.match(/[^.!?]+/)?.[0] ?? line)
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return first;
}

/**
 * Exactly two visual sentences: palette relationship, then structure/texture.
 * `insight` selects a distinct sentence architecture (not synonym swaps).
 * Climate may add a brief rain note only when the brief is rain/snow.
 */
export function richWhy(
  pieces: Garment[],
  occasion: RoutineId | string,
  climate: Climate,
  insight: WhyInsight = "tonal",
): string {
  if (!pieces.length) return "";
  const routine = asRoutine(String(occasion));

  const s1 =
    scrub(paletteSentence(pieces, insight, climate) || "") ||
    "The colors stay related across the kit";
  const s2 =
    scrub(structureSentence(pieces, insight, routine, climate) || "") ||
    "The hang reads stacked rather than flat";

  let text = [endSentence(s1), endSentence(s2)].join(" ");

  if (wordCount(text) < 18) {
    text = `${text} ${endSentence("so the hang reads stacked rather than flat")}`.trim();
    text = clampWords(text, 50);
    const bits = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    text = bits.slice(0, 2).join(" ");
  }

  return clampWords(text, 50);
}

export function insightForIndex(i: number): WhyInsight {
  return WHY_INSIGHTS[i % WHY_INSIGHTS.length]!;
}

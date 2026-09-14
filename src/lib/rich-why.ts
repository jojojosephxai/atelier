import type { RoutineId } from "./routines.ts";
import type { Climate, Garment } from "./types.ts";

/** Insight angle — three Today cards should use three different ones. */
export type WhyInsight = "tonal" | "accent" | "texture" | "silhouette";

export const WHY_INSIGHTS: WhyInsight[] = [
  "tonal",
  "accent",
  "texture",
  "silhouette",
];

const FILLER =
  /\b(comfortable|casual|good for school|calm and composed|easy and composed|sleek and confident|clean and fresh|natural and calm|understated|warm and approachable|grounded and warm|stylish and versatile|perfect for any|looks great together|wet-weather|mild day|umbrella|AC[-\s]?shell|cold gym layer)\b/i;

const FIT_RE =
  /\b(relaxed|oversized|fitted|straight(?:-leg)?|slim|cropped|tailored|loose|boxy|skinny|wide|knee[- ]length)\b/i;

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
  if (!t || FILLER.test(t)) return "";
  if (/is the wet-weather|even on a mild/i.test(t)) return "";
  if (
    /navy rain shell|navy polo knit|navy harrington|black merino crew|indigo denim jacket/i.test(
      t,
    )
  ) {
    return "";
  }
  if (/\b(harrington|hoodie|rain shell) over\b/i.test(t)) return "";
  return t;
}

function depthRead(color: string): string {
  const c = color.toLowerCase();
  if (/navy/.test(c)) return "contained depth because contrast stays low";
  if (/black/.test(c)) return "dense weight because the values stay closed";
  if (/charcoal|grey|gray|heather/.test(c)) {
    return "quiet mid-tone weight because nothing spikes";
  }
  if (/indigo|blue/.test(c)) {
    return "cool depth because the field stays continuous";
  }
  if (/olive|forest|green/.test(c)) {
    return "earthy hold because the chroma stays mute";
  }
  if (/white|ivory/.test(c)) return "open light against a darker field";
  if (/beige|cream|camel|sand|stone|khaki/.test(c)) {
    return "warm ground because the chroma stays low";
  }
  return "a tighter field because nothing spikes";
}

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

  if (insight === "accent" && shoes && top && colorOf(shoes)) {
    const shoeC = colorOf(shoes);
    if (outer && top && sameFamily(outer, top) && bottom) {
      const c = colorOf(outer) || colorOf(top);
      return scrub(
        `Tonal ${c.toLowerCase()} on the ${roleNoun(outer)} and ${roleNoun(top)} keeps ${depthRead(c)}, with ${colorOf(bottom).toLowerCase()} in the ${roleNoun(bottom)} and ${shoeC.toLowerCase()} at the ${roleNoun(shoes)} as supporting breaks`,
      );
    }
    if (outer && top && sameFamily(outer, top)) {
      const c = colorOf(outer) || colorOf(top);
      return scrub(
        `Tonal ${c.toLowerCase()} through the ${roleNoun(outer)} and ${roleNoun(top)} — ${depthRead(c)}; ${shoeC.toLowerCase()} at the ${roleNoun(shoes)} is the accent break`,
      );
    }
  }

  if (outer && top && sameFamily(outer, top)) {
    const c = colorOf(outer) || colorOf(top);
    if (bottom && !sameFamily(top, bottom)) {
      return scrub(
        `Tonal ${c.toLowerCase()} on the ${roleNoun(outer)} and ${roleNoun(top)} keeps ${depthRead(c)}; ${colorOf(bottom).toLowerCase()} in the ${roleNoun(bottom)} is the mute shift below`,
      );
    }
    return scrub(
      `Tonal ${c.toLowerCase()} on the ${roleNoun(outer)} and ${roleNoun(top)} keeps ${depthRead(c)} in one register${
        bottom
          ? `, with ${colorOf(bottom).toLowerCase()} in the ${roleNoun(bottom)} as a darker continuation`
          : ""
      }`,
    );
  }

  if (outer && top) {
    const oc = colorOf(outer);
    const tc = colorOf(top);
    if (oc && tc && oc.toLowerCase() !== tc.toLowerCase()) {
      return scrub(
        `${oc} against ${tc.toLowerCase()} is value contrast rather than a loud break`,
      );
    }
  }

  if (layer && top) {
    const lc = colorOf(layer);
    const tc = colorOf(top);
    if (lc && tc && sameFamily(layer, top)) {
      return scrub(
        `Tonal ${lc.toLowerCase()} through the upper stack — monochrome weight rather than a contrast break`,
      );
    }
    if (lc && tc) {
      return scrub(
        `${lc} against ${tc.toLowerCase()} is a mute value shift, not a loud accent`,
      );
    }
  }

  if (top && bottom) {
    const tc = colorOf(top);
    const bc = colorOf(bottom);
    if (tc && bc && sameFamily(top, bottom)) {
      return scrub(
        `Tonal ${tc.toLowerCase()} down the line stays in one register — ${depthRead(tc)}`,
      );
    }
    if (tc && bc) {
      if (isNeutralHex(top.hex) && isNeutralHex(bottom.hex)) {
        return scrub(
          `${tc} and ${bc.toLowerCase()} stay in one mute register, ${depthRead(tc)}`,
        );
      }
      return scrub(
        `${tc} lands on ${bc.toLowerCase()} below — ${depthRead(tc)} meeting steadier ground`,
      );
    }
  }

  if (climate === "rain" && outer) {
    const c = colorOf(outer) || (top ? colorOf(top) : "");
    return scrub(
      `Tonal ${(c || "navy").toLowerCase()} stacked on ${(c || "navy").toLowerCase()} keeps ${depthRead(c || "navy")}`,
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
      `${colors[0]} and ${colors[1]!.toLowerCase()} share one mute register across the kit`,
    );
  }
  if (colors.length === 1) {
    return scrub(
      `Tonal ${colors[0]!.toLowerCase()} holds the field — ${depthRead(colors[0]!)}`,
    );
  }
  return scrub("The palette stays in one mute register");
}

function structureSentence(
  pieces: Garment[],
  _insight: WhyInsight,
  routine: RoutineId,
  climate: Climate,
): string {
  const outer = outerOf(pieces);
  const top = topOf(pieces);
  const bottom = bottomOf(pieces);
  const layer = layerOf(pieces);
  const sil = fitOf(pieces);

  if (outer && top) {
    const tech = /nylon|shell|technical/i.test(`${matOf(outer)} ${outer.name}`);
    const soft = /knit|merino|jersey|cotton|fleece|linen/i.test(
      `${matOf(top)} ${top.name}`,
    );
    if (tech && soft) {
      if (climate === "rain") {
        return scrub(
          `Nylon against cotton knit is the texture break, so the shell face stays crisp in rain rather than going dull`,
        );
      }
      return scrub(
        `Nylon against cotton knit is the texture break, so the outline stays sharp while the body stays soft`,
      );
    }
    if (matOf(outer) && matOf(top) && matOf(outer).toLowerCase() !== matOf(top).toLowerCase()) {
      return scrub(
        `${matOf(outer)} against ${matOf(top).toLowerCase()} is the texture break, so a sharper outer frames a softer body`,
      );
    }
    if (sil) {
      return scrub(
        `${sil.charAt(0).toUpperCase()}${sil.slice(1)} cut keeps volume easy, so the inner layer hangs cleaner under a sharper frame rather than fighting it`,
      );
    }
    return scrub(
      `A sharper outer line keeps structure outside, so the body hangs softer underneath rather than flattening the stack`,
    );
  }

  if (layer) {
    const oversized =
      sil === "oversized" || /oversized/i.test(`${layer.name} ${layer.notes}`);
    if (oversized && bottom) {
      return scrub(
        `Oversized fleece adds volume up top, so the ${roleNoun(bottom)} keep a cleaner athletic hang underneath`,
      );
    }
    if (bottom) {
      return scrub(
        `Fleece against a closer cotton layer is the soft break, so the ${roleNoun(bottom)} finish the athletic outline`,
      );
    }
    return scrub(
      `Oversized fleece adds volume, so the athletic outline hangs ready to move rather than going tight`,
    );
  }

  if (top && bottom) {
    const tm = matOf(top);
    const bm = matOf(bottom);
    if (tm && bm && tm.toLowerCase() !== bm.toLowerCase()) {
      return scrub(
        `${tm} against ${bm.toLowerCase()} is the texture break, so the ${roleNoun(top)} and ${roleNoun(bottom)} hang as related rather than matched`,
      );
    }
    if (sil) {
      return scrub(
        `${sil.charAt(0).toUpperCase()}${sil.slice(1)} cut links both halves, so the outline reads as one hang rather than two pieces`,
      );
    }
    if (routine === "gym") {
      return scrub(
        `Athletic cut through the line keeps volume ready, so the kit hangs to move rather than to pose`,
      );
    }
    return scrub(
      `Proportions link both halves, so the outline hangs as one rather than two separate pieces`,
    );
  }

  if (outer) {
    return scrub(
      `The ${roleNoun(outer)} sets the outer outline, so everything under it stays secondary rather than competing`,
    );
  }
  return scrub(
    "Structure holds as one outline, so the hang reads stacked rather than flat",
  );
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

/**
 * Exactly two visual sentences: palette relationship, then structure/texture.
 * `insight` shifts which relationship leads so a set of three looks stays distinct.
 * Climate may add a brief visual rain note only when the brief is rain/snow.
 */
export function richWhy(
  pieces: Garment[],
  occasion: RoutineId | string,
  climate: Climate,
  insight: WhyInsight = "tonal",
): string {
  if (!pieces.length) return "";
  const routine = asRoutine(String(occasion));

  const shoes = shoesOf(pieces);
  let focus = insight;
  if (
    insight === "tonal" &&
    shoes &&
    /white|ivory/i.test(colorOf(shoes)) &&
    bottomOf(pieces)
  ) {
    focus = "accent";
  }

  const s1 =
    scrub(paletteSentence(pieces, focus, climate) || "") ||
    "Tonal neutrals stay in one mute register across the kit";
  const s2 =
    scrub(structureSentence(pieces, focus, routine, climate) || "") ||
    "Texture and outline hold together, so the hang reads as one rather than apart";

  let text = [endSentence(s1), endSentence(s2)].join(" ");

  if (wordCount(text) < 18) {
    text = `${text} ${endSentence("so the hang reads stacked rather than flat")}`.trim();
    text = clampWords(text, 50);
    // Re-trim to two sentences after pad
    const bits = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    text = bits.slice(0, 2).join(" ");
  }

  return clampWords(text, 50);
}

export function insightForIndex(i: number): WhyInsight {
  return WHY_INSIGHTS[i % WHY_INSIGHTS.length]!;
}

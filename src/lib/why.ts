import { richWhy } from "./rich-why.ts";
import type { Climate, Extra, Garment } from "./types";

function sceneOf(occasion: string) {
  const o = occasion.toLowerCase();
  if (/\b(school|class|campus|hall)\b/.test(o)) return "school" as const;
  if (/\b(weekend|errand|saturday|sunday)\b/.test(o)) return "weekend" as const;
  if (/\b(gym|pe|athletic|workout|run)\b/.test(o)) return "gym" as const;
  if (/\b(work|office|business)\b/.test(o)) return "work" as const;
  if (/\b(out|dinner|date|evening|night|wedding)\b/.test(o)) return "out" as const;
  return "day" as const;
}

function climateFromOccasion(occasion: string): Climate {
  const o = occasion.toLowerCase();
  if (/\brain|wet\b/.test(o)) return "rain";
  if (/\bsnow\b/.test(o)) return "snow";
  if (/\bcold\b/.test(o)) return "cold";
  if (/\bhot\b/.test(o)) return "hot";
  if (/\bwarm\b/.test(o)) return "warm";
  if (/\bcool\b/.test(o)) return "cool";
  return "mild";
}

export function whyLookWorks(
  pieces: Garment[],
  extras: Extra[] = [],
  occasion = "",
  climate?: Climate,
): string {
  if (!pieces.length) return "";
  const scene = sceneOf(occasion);
  const routine =
    scene === "gym"
      ? "gym"
      : scene === "school"
        ? "school"
        : scene === "out"
          ? "out"
          : "weekend";
  const cl = climate ?? climateFromOccasion(occasion);
  void extras;
  return richWhy(pieces, routine, cl);
}

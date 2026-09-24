import { lookName } from "./board-set.ts";
import type { RoutineId } from "./routines.ts";
import type { Garment } from "./types.ts";

/** Site share card (orange tee, straw hat, sneaker). Never a kit image. */
const SHARE_CARD = /(?:^|\/)og\.(?:jpe?g|png|webp)(?:[?#]|$)/i;

/** Drop the site share card if it was stored as a garment photo. */
export function visibleGarmentSrc(src: string | undefined): string | undefined {
  if (!src || isShareCardSrc(src)) return undefined;
  return src;
}

export function isShareCardSrc(src: string | undefined): boolean {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return false;
  const path = src.startsWith("/")
    ? src
    : (() => {
        try {
          return new URL(src).pathname;
        } catch {
          return src;
        }
      })();
  return SHARE_CARD.test(path);
}

/**
 * Today / compose / looks cards. Title and garment ids are the same pieces.
 * A saved flat-lay (`photo`) is ignored so it cannot replace the kit grid.
 */
export function lookCardModel(
  pieces: Garment[],
  routine: RoutineId,
  _photo?: string,
): { title: string; garmentIds: string[] } {
  void _photo;
  return {
    title: lookName(pieces, routine),
    garmentIds: pieces.map((g) => g.id),
  };
}

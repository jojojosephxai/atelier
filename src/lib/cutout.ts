/**
 * TEMPORARY STUB — do not merge this PR until cutout.ts is restored from main.
 * git checkout origin/main -- src/lib/cutout.ts
 * Expected blob SHA: 1d022e1cbf12c6751635ff54edb515e4f8124ec8
 */
export const CUT_PAD = 0.05;
export type CutMode = "garment" | "product";
export function cutBudget(): { used: number; cap: number; ok: boolean } {
  return { used: 0, cap: 8, ok: true };
}
export function preloadCutter(): Promise<void> {
  return Promise.resolve();
}
export function needsCutout(_src: string): boolean {
  return false;
}
export function hardenMatte(_img: ImageData, _mode: CutMode): void {}
export async function cutGarment(
  _file: File,
  _onProgress?: (msg: string) => void,
  _signal?: AbortSignal,
  _keepLabel?: boolean,
): Promise<Blob> {
  throw new Error("cutout.ts stub — restore from main before merge");
}
export async function cutProduct(
  _file: File,
  _onProgress?: (msg: string) => void,
  _signal?: AbortSignal,
): Promise<Blob> {
  throw new Error("cutout.ts stub — restore from main before merge");
}
export function refineMatte(_img: ImageData, _profile: unknown): void {}
export function frameCutBounds(
  _imgW: number,
  _imgH: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  _padRatio = CUT_PAD,
): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: bounds.x0, y0: bounds.y0, x1: bounds.x1 + 1, y1: bounds.y1 + 1 };
}
export function trimSubjectView(
  _imgW: number,
  _imgH: number,
  _bounds: { x0: number; y0: number; x1: number; y1: number },
): { x: number; y: number; w: number; h: number } | null {
  return null;
}
export function knockBackground(
  img: HTMLImageElement,
  _maxEdge = 1400,
): string {
  return img.src;
}

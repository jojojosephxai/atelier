import { create } from "zustand";

type LookEditor = {
  canvasId: string | null;
  pieceId: string | null;
  showGuides: boolean;
  select: (canvasId: string, pieceId: string | null) => void;
  clear: () => void;
  setGuides: (on: boolean) => void;
};

export const useLookEditor = create<LookEditor>((set) => ({
  canvasId: null,
  pieceId: null,
  showGuides: false,
  select: (canvasId, pieceId) => set({ canvasId, pieceId }),
  clear: () => set({ canvasId: null, pieceId: null }),
  setGuides: (on) => set({ showGuides: on }),
}));

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest("[data-look-canvas]")) return;
    useLookEditor.getState().clear();
  });
}

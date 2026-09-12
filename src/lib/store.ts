import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Extra, Garment, Look, Profile } from "./types";
import { SAMPLE_IMAGES } from "./media";
import { BOARD_REV, DEFAULT_BOARD } from "./board";
import { SAMPLE_TAGS, createSampleCloset } from "./seed";
import { todayISO, uid } from "./utils";
import { referencedPhotoIds, rebindPhotoUrls, sweepOrphanPhotos } from "./photo-db";

type WardrobeState = {
  garments: Garment[];
  extras: Extra[];
  looks: Look[];
  profile: Profile;
  seeded: boolean;
  addGarment: (g: Omit<Garment, "id" | "createdAt"> & { id?: string }) => string;
  updateGarment: (id: string, patch: Partial<Garment>) => void;
  removeGarment: (id: string) => void;
  addExtra: (e: Omit<Extra, "id" | "createdAt"> & { id?: string }) => string;
  updateExtra: (id: string, patch: Partial<Extra>) => void;
  removeExtra: (id: string) => void;
  addLook: (l: Omit<Look, "id" | "createdAt"> & { id?: string }) => string;
  wearToday: (l: Omit<Look, "id" | "createdAt" | "plannedDate"> & { id?: string }) => string;
  updateLook: (id: string, patch: Partial<Look>) => void;
  removeLook: (id: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  loadSample: () => void;
  replaceAll: (data: {
    garments: Garment[];
    extras: Extra[];
    looks: Look[];
    profile?: Profile;
  }) => void;
  clearAll: () => void;
};

export const emptyProfile: Profile = {
  styleNotes: "",
  defaultClimate: "mild",
  theme: "light",
  lookLayout: "grid",
  layoutRev: 2,
  wornLog: [],
  lookVotes: {},
  lookRegen: 0,
  pieceLayout: {},
  pieceHidden: {},
  piecePlaced: {},
  torsoPick: {},
  boardSlots: DEFAULT_BOARD.map((s) => ({ ...s })),
  boardRev: BOARD_REV,
};

function bindPhotoFields<T extends {
  id: string;
  imageSrc?: string;
  imageDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
}>(item: T): T {
  const sample = Boolean(SAMPLE_IMAGES[item.id]);
  const photoBlobId = sample
    ? undefined
    : item.photoBlobId || item.imageBlobId;
  const src = sample
    ? SAMPLE_IMAGES[item.id]
    : item.imageSrc?.startsWith("data:")
      ? undefined
      : item.imageSrc;
  return {
    ...item,
    imageSrc: src,
    imageDataUrl: undefined,
    imageBlobId: undefined,
    photoBlobId,
  };
}

function persistPiece<T extends {
  id: string;
  imageSrc?: string;
  imageDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
}>(item: T): T {
  return bindPhotoFields(item);
}

function normalizeProfile(p?: Partial<Profile>): Profile {
  const merged = { ...emptyProfile, ...p };
  if ((merged.layoutRev ?? 0) < 2) {
    merged.lookLayout = "grid";
    merged.layoutRev = 2;
  }
  if (merged.boardRev === BOARD_REV && merged.boardSlots?.length) {
    return merged;
  }
  return {
    ...merged,
    boardRev: BOARD_REV,
    boardSlots: DEFAULT_BOARD.map((s) => ({ ...s })),
  };
}

function normalizeGarment(g: Garment): Garment {
  const tags = Array.isArray(g.tags) ? [...g.tags] : [];
  if (SAMPLE_TAGS[g.id]?.includes("School") && !tags.includes("School")) {
    tags.push("School");
  }
  return bindPhotoFields({
    ...g,
    tags,
    displayScale:
      typeof g.displayScale === "number" && Number.isFinite(g.displayScale)
        ? Math.min(2.2, Math.max(0.4, g.displayScale))
        : undefined,
    displayX:
      typeof g.displayX === "number" && Number.isFinite(g.displayX)
        ? Math.min(45, Math.max(-45, g.displayX))
        : undefined,
    displayY:
      typeof g.displayY === "number" && Number.isFinite(g.displayY)
        ? Math.min(45, Math.max(-45, g.displayY))
        : undefined,
  });
}

function normalizeExtra(e: Extra): Extra {
  const sample = createSampleCloset().extras.find((x) => x.id === e.id);
  return bindPhotoFields({
    ...e,
    tags: Array.isArray(e.tags) ? e.tags : [],
    slot: e.slot ?? sample?.slot,
    step: e.step ?? sample?.step,
    kind: e.kind ?? sample?.kind ?? "skincare",
  });
}

function debounceStorage(ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { name: string; value: string } | undefined;
  return {
    getItem: (name: string) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!pending) return;
        try {
          localStorage.setItem(pending.name, pending.value);
        } catch {
          /* quota */
        }
        pending = undefined;
      }, ms);
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

const SAMPLE = createSampleCloset();
let hydrateSweepDone = false;

export const useWardrobe = create<WardrobeState>()(
  persist(
    (set, get) => ({
      garments: SAMPLE.garments.map(normalizeGarment),
      extras: SAMPLE.extras.map(normalizeExtra),
      looks: SAMPLE.looks,
      profile: emptyProfile,
      seeded: true,
      addGarment: (g) => {
        const id = g.id ?? uid("g");
        set({
          garments: [
            {
              ...g,
              id,
              tags: g.tags ?? [],
              createdAt: Date.now(),
            },
            ...get().garments,
          ],
        });
        return id;
      },
      updateGarment: (id, patch) =>
        set({
          garments: get().garments.map((g) =>
            g.id === id ? { ...g, ...patch, id } : g,
          ),
        }),
      removeGarment: (id) => {
        set({
          garments: get().garments.filter((x) => x.id !== id),
          looks: get().looks.map((l) => ({
            ...l,
            garmentIds: l.garmentIds.filter((x) => x !== id),
          })),
        });
        void sweepOrphanPhotos(referencedPhotoIds(get()));
      },
      addExtra: (e) => {
        const id = e.id ?? uid("e");
        set({
          extras: [
            { ...e, id, tags: e.tags ?? [], createdAt: Date.now() },
            ...get().extras,
          ],
        });
        return id;
      },
      updateExtra: (id, patch) =>
        set({
          extras: get().extras.map((e) =>
            e.id === id ? { ...e, ...patch, id } : e,
          ),
        }),
      removeExtra: (id) => {
        set({
          extras: get().extras.filter((x) => x.id !== id),
          looks: get().looks.map((l) => ({
            ...l,
            extraIds: l.extraIds.filter((x) => x !== id),
          })),
        });
        void sweepOrphanPhotos(referencedPhotoIds(get()));
      },
      addLook: (l) => {
        const id = l.id ?? uid("l");
        set({
          looks: [{ ...l, id, createdAt: Date.now() }, ...get().looks],
        });
        return id;
      },
      wearToday: (l) => {
        const today = todayISO();
        const looks = get().looks.map((x) =>
          x.plannedDate === today ? { ...x, plannedDate: undefined } : x,
        );
        const existing = l.id ? looks.find((x) => x.id === l.id) : undefined;
        const garmentIds = existing?.garmentIds ?? l.garmentIds;
        const wornLog = [
          { date: today, garmentIds },
          ...(get().profile.wornLog ?? []).filter((w) => w.date !== today),
        ].slice(0, 14);
        if (existing) {
          set({
            looks: looks.map((x) =>
              x.id === existing.id ? { ...x, plannedDate: today } : x,
            ),
            profile: { ...get().profile, wornLog },
          });
          return existing.id;
        }
        const id = uid("l");
        set({
          looks: [
            { ...l, id, plannedDate: today, createdAt: Date.now() },
            ...looks,
          ],
          profile: { ...get().profile, wornLog },
        });
        return id;
      },
      updateLook: (id, patch) =>
        set({
          looks: get().looks.map((l) =>
            l.id === id ? { ...l, ...patch, id } : l,
          ),
        }),
      removeLook: (id) =>
        set({ looks: get().looks.filter((l) => l.id !== id) }),
      setProfile: (patch) =>
        set({ profile: { ...get().profile, ...patch } }),
      loadSample: () => {
        const sample = createSampleCloset();
        set({
          garments: sample.garments.map(normalizeGarment),
          extras: sample.extras.map(normalizeExtra),
          looks: sample.looks,
          profile: { ...get().profile, wornLog: [], skipDemo: false },
          seeded: true,
        });
        void sweepOrphanPhotos(referencedPhotoIds(get()));
      },
      replaceAll: (data) =>
        set({
          garments: data.garments.map(normalizeGarment),
          extras: data.extras.map(normalizeExtra),
          looks: data.looks,
          profile: normalizeProfile(data.profile),
          seeded: true,
        }),
      clearAll: () => {
        const profile = get().profile;
        set({
          garments: [],
          extras: [],
          looks: [],
          profile: {
            ...profile,
            styleNotes: "",
            defaultClimate: "mild",
            wornLog: [],
            lookVotes: {},
          },
          seeded: true,
        });
        void sweepOrphanPhotos(new Set());
      },
    }),
    {
      name: "atelier-wardrobe-v2",
      skipHydration: true,
      storage: createJSONStorage(() => debounceStorage(180)),
      partialize: (s) => ({
        garments: s.garments.map((g) => persistPiece(g)),
        extras: s.extras.map((e) => persistPiece(e)),
        looks: s.looks.map((l) => {
          const { photoDataUrl: _drop, ...rest } = l;
          return rest;
        }),
        profile: s.profile,
        seeded: s.seeded,
      }),
    },
  ),
);

function ensureSampleLooks(state: {
  garments: Garment[];
  looks: Look[];
}): Look[] {
  if (!state.garments.some((g) => g.id === "g_grey_tee")) return state.looks;
  const needed = createSampleCloset().looks.filter((l) =>
    l.id.startsWith("l_school"),
  );
  const have = new Set(state.looks.map((l) => l.id));
  const missing = needed.filter((l) => !have.has(l.id));
  return missing.length ? [...missing, ...state.looks] : state.looks;
}

function ensureSampleGarments(garments: Garment[]): Garment[] {
  const sample = createSampleCloset().garments;
  const have = new Set(garments.map((g) => g.id));
  const missing = sample.filter((g) => !have.has(g.id));
  return missing.length
    ? [...missing.map(normalizeGarment), ...garments]
    : garments;
}

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let alive = true;
    const persistApi = useWardrobe.persist;
    const finish = () => {
      if (!alive) return;
      const state = useWardrobe.getState();
      if (!state.seeded && state.garments.length === 0) {
        state.loadSample();
      } else if (state.profile.skipDemo) {
        useWardrobe.setState({
          garments: state.garments.map(normalizeGarment),
          extras: state.extras.map(normalizeExtra),
          profile: normalizeProfile(state.profile),
          looks: state.looks,
        });
      } else {
        useWardrobe.setState({
          garments: ensureSampleGarments(state.garments.map(normalizeGarment)),
          extras: state.extras.map(normalizeExtra),
          profile: normalizeProfile(state.profile),
          looks: ensureSampleLooks(state),
        });
      }
      const bound = useWardrobe.getState();
      void rebindPhotoUrls(referencedPhotoIds(bound)).finally(() => {
        if (!alive) return;
        setHydrated(true);
        if (!hydrateSweepDone) {
          hydrateSweepDone = true;
          void sweepOrphanPhotos(referencedPhotoIds(useWardrobe.getState()));
        }
      });
    };
    if (persistApi.hasHydrated()) {
      finish();
      return () => {
        alive = false;
      };
    }
    const result = persistApi.rehydrate();
    if (result && typeof result.then === "function") {
      void result.then(finish);
    } else {
      finish();
    }
    return () => {
      alive = false;
    };
  }, []);
  return hydrated;
}

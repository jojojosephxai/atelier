import { lookEligible } from "./board-set";
import { SAMPLE_IMAGES } from "./media";
import {
  allPhotos,
  putPhotos,
  rebindPhotoUrls,
  referencedPhotoIds,
} from "./photo-db";
import type { Extra, Garment, Look, Profile } from "./types";

export type PersistPackV3 = {
  version: 3;
  wardrobe: {
    garments: Garment[];
    extras: Extra[];
    looks: Look[];
    profile?: Profile;
    seeded?: boolean;
  };
  blobs: Record<string, string>;
};

function isUserPiece(id: string) {
  return !SAMPLE_IMAGES[id];
}

function stripGarment(g: Garment): Garment {
  const photoBlobId = isUserPiece(g.id)
    ? g.photoBlobId || g.imageBlobId
    : undefined;
  return {
    ...g,
    imageDataUrl: undefined,
    imageBlobId: undefined,
    imageSrc: isUserPiece(g.id)
      ? g.imageSrc?.startsWith("data:")
        ? undefined
        : g.imageSrc
      : undefined,
    photoBlobId,
  };
}

function stripExtra(e: Extra): Extra {
  const photoBlobId = isUserPiece(e.id)
    ? e.photoBlobId || e.imageBlobId
    : undefined;
  return {
    ...e,
    imageDataUrl: undefined,
    imageBlobId: undefined,
    imageSrc: isUserPiece(e.id)
      ? e.imageSrc?.startsWith("data:")
        ? undefined
        : e.imageSrc
      : undefined,
    photoBlobId,
  };
}

function stripLook(l: Look): Look {
  const { photoDataUrl: _drop, ...rest } = l;
  return { ...rest, photoDataUrl: undefined };
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) chars[i] = String.fromCharCode(bytes[i]);
  return btoa(chars.join(""));
}

function b64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

export function validatePersistPack(raw: unknown): PersistPackV3 {
  if (!raw || typeof raw !== "object") throw new Error("Not an Atelier pack");
  const pack = raw as PersistPackV3;
  if (pack.version !== 3) throw new Error("Need .atelier.json v3");
  const w = pack.wardrobe;
  if (!w || !Array.isArray(w.garments) || !Array.isArray(w.extras)) {
    throw new Error("Pack is missing a wardrobe");
  }
  if (!Array.isArray(w.looks)) throw new Error("Pack is missing looks");
  if (!pack.blobs || typeof pack.blobs !== "object") {
    throw new Error("Pack is missing photos");
  }
  const incomplete = w.garments.filter(
    (g) => isUserPiece(g.id) && !lookEligible(g),
  );
  if (incomplete.length) {
    throw new Error(
      "Closet pieces need category, formality, climate, and color family.",
    );
  }
  return pack;
}

export async function persistPack(state: {
  garments: Garment[];
  extras: Extra[];
  looks: Look[];
  profile: Profile;
  seeded: boolean;
}): Promise<PersistPackV3> {
  const garments = state.garments.map(stripGarment);
  const extras = state.extras.map(stripExtra);
  const looks = state.looks.map(stripLook);
  const keep = referencedPhotoIds({ garments, extras, looks });
  const stored = await allPhotos();
  const blobs: Record<string, string> = {};
  for (const id of keep) {
    const blob = stored[id];
    if (!blob) continue;
    blobs[id] = await blobToB64(blob);
  }
  return {
    version: 3,
    wardrobe: {
      garments,
      extras,
      looks,
      profile: state.profile,
      seeded: state.seeded,
    },
    blobs,
  };
}

export async function applyPersistPack(raw: unknown): Promise<{
  garments: Garment[];
  extras: Extra[];
  looks: Look[];
  profile?: Profile;
  seeded?: boolean;
}> {
  const pack = validatePersistPack(raw);
  const garments = pack.wardrobe.garments.map(stripGarment);
  const extras = pack.wardrobe.extras.map(stripExtra);
  const looks = pack.wardrobe.looks.map(stripLook);
  const photos: Record<string, Blob> = {};
  for (const [id, b64] of Object.entries(pack.blobs)) {
    if (typeof b64 !== "string" || !b64) continue;
    photos[id] = b64ToBlob(b64);
  }
  await putPhotos(photos);
  const ids = referencedPhotoIds({ garments, extras, looks });
  await rebindPhotoUrls(ids);
  return {
    garments,
    extras,
    looks,
    profile: pack.wardrobe.profile,
    seeded: pack.wardrobe.seeded,
  };
}

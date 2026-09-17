const DB_NAME = "atelier-photos";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("No photo store"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const urlCache = new Map<string, string>();

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(blob, id);
  });
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export async function clearPhotos(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).clear();
  });
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

type PhotoRef = {
  imageBlobId?: string;
  photoBlobId?: string;
};

function takeId(into: Set<string>, value?: string) {
  if (typeof value === "string" && value) into.add(value);
}

/** Every blob key still pointed at by wardrobe records. */
export function referencedPhotoIds(input: {
  garments?: PhotoRef[];
  extras?: PhotoRef[];
  looks?: PhotoRef[];
}): Set<string> {
  const ids = new Set<string>();
  for (const row of input.garments ?? []) {
    takeId(ids, row.imageBlobId);
    takeId(ids, row.photoBlobId);
  }
  for (const row of input.extras ?? []) {
    takeId(ids, row.imageBlobId);
    takeId(ids, row.photoBlobId);
  }
  for (const row of input.looks ?? []) {
    takeId(ids, row.imageBlobId);
    takeId(ids, row.photoBlobId);
  }
  return ids;
}

export async function listPhotoKeys(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () =>
      resolve((req.result as IDBValidKey[]).map((k) => String(k)));
    req.onerror = () => reject(req.error);
  });
}

export async function sweepOrphanPhotos(keep: Set<string>): Promise<void> {
  if (keep.size === 0) {
    await clearPhotos();
    return;
  }
  const db = await openDb();
  const dropped: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const finishKeys = (keys: IDBValidKey[]) => {
      for (const raw of keys) {
        const key = String(raw);
        if (keep.has(key)) continue;
        store.delete(raw);
        dropped.push(key);
      }
    };
    if (typeof store.getAllKeys === "function") {
      const req = store.getAllKeys();
      req.onsuccess = () => finishKeys(req.result as IDBValidKey[]);
      req.onerror = () => reject(req.error);
    } else {
      const keys: IDBValidKey[] = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          keys.push(cursor.primaryKey);
          cursor.continue();
          return;
        }
        finishKeys(keys);
      };
      req.onerror = () => reject(req.error);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  for (const key of dropped) {
    const url = urlCache.get(key);
    if (!url) continue;
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

export async function allPhotos(): Promise<Record<string, Blob>> {
  const keys = await listPhotoKeys();
  const out: Record<string, Blob> = {};
  for (const key of keys) {
    const blob = await getPhoto(key);
    if (blob) out[key] = blob;
  }
  return out;
}

export async function putPhotos(blobs: Record<string, Blob>): Promise<void> {
  const ids = Object.keys(blobs);
  if (!ids.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    for (const id of ids) store.put(blobs[id], id);
  });
}

export async function rebindPhotoUrls(
  ids: Iterable<string>,
): Promise<void> {
  await Promise.all(
    [...ids].map((id) => photoUrl(id).catch(() => undefined)),
  );
}

export function cachedPhotoUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return urlCache.get(id);
}

export async function photoUrl(id: string): Promise<string | undefined> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const blob = await getPhoto(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

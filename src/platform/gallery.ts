// Saved renders, kept on the device in IndexedDB. Nothing leaves the device.

export interface GalleryItem {
  id: string;
  createdAt: number;
  width: number;
  height: number;
  type: string;
  blob: Blob;
  thumbnail: Blob;
  /** Format and colour summary for the card, e.g. "440 ml · Silver". */
  title: string;
}

const DB = "cantare";
const STORE = "renders";
const BACKGROUNDS = "backgrounds";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      if (event.oldVersion < 2) db.createObjectStore(BACKGROUNDS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>, name = STORE): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(name, mode).objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function thumbnailOf(blob: Blob, size = 480): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = size / Math.max(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("thumbnail"))), "image/jpeg", 0.82));
}

export async function addToGallery(item: Omit<GalleryItem, "id" | "createdAt" | "thumbnail">): Promise<GalleryItem> {
  const full: GalleryItem = { ...item, id: crypto.randomUUID(), createdAt: Date.now(), thumbnail: await thumbnailOf(item.blob) };
  await tx("readwrite", (store) => store.put(full));
  return full;
}

export async function listGallery(): Promise<GalleryItem[]> {
  const items = await tx<GalleryItem[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeFromGallery(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}

export interface RecentBackground {
  id: string;
  createdAt: number;
  prompt: string;
  blob: Blob;
}

const RECENT_LIMIT = 8;

/** Generated backgrounds, kept on the device so they can be reused without paying again. */
export async function addRecentBackground(prompt: string, blob: Blob): Promise<void> {
  await tx("readwrite", (store) => store.put({ id: crypto.randomUUID(), createdAt: Date.now(), prompt, blob }), BACKGROUNDS);
  const all = await listRecentBackgrounds();
  for (const old of all.slice(RECENT_LIMIT)) await tx("readwrite", (store) => store.delete(old.id), BACKGROUNDS);
}

export async function listRecentBackgrounds(): Promise<RecentBackground[]> {
  const items = await tx<RecentBackground[]>("readonly", (store) => store.getAll(), BACKGROUNDS);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

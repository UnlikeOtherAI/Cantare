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

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
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

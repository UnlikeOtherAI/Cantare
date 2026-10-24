// Keeps the scene on this device: the current scene autosaves to localStorage (restored before the
// first render), image bytes live in IndexedDB keyed by content hash, and named setups sit beside
// them. Nothing here leaves the device. Every storage call is guarded: private modes can throw.

import { DEFAULT_SETTINGS, type CanSettings } from "../engine/settings";
import { useEditor } from "../state/editor";
import { decodeScene, encodeScene, sanitizeImages, SCHEMA_VERSION, type ImageRefs, type SceneUi } from "../state/sceneSchema";
import { useUi } from "../state/ui";

const SCENE_KEY = "cantare.scene";
const DB = "cantare-state";
const IMAGES = "images";
const SETUPS = "setups";
const SAVE_DELAY = 400;
/** Unreferenced images younger than this survive cleanup: another tab may be about to use them. */
const GRACE_MS = 10 * 60_000;

interface StoredImage {
  hash: string;
  blob: Blob;
  createdAt: number;
}

export interface Setup {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  v: number;
  settings: CanSettings;
  images: ImageRefs;
  ui: Omit<SceneUi, "sceneName">;
  thumbnail: Blob | null;
}

// ------------------------------------------------------------------ storage

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or quota: the scene simply isn't kept.
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES, { keyPath: "hash" });
        if (!db.objectStoreNames.contains(SETUPS)) db.createObjectStore(SETUPS, { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB blocked"));
    } catch (error) {
      reject(error);
    }
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

async function idb<T>(store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(store, mode);
      const request = run(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error("aborted"));
    } catch (error) {
      reject(error);
    }
  });
}

// ------------------------------------------------------------------- images

async function hashBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    try {
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Insecure context: fall through to the plain hash.
    }
  }
  // FNV-1a twice with different seeds, plus the length: enough to dedupe without SubtleCrypto.
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i], 0x01000193);
    b = Math.imul(b ^ bytes[i], 0x5bd1e995);
  }
  return [a >>> 0, b >>> 0, bytes.length].map((n) => n.toString(16).padStart(8, "0")).join("");
}

/** Live URL → the bytes behind it, for every image this session has seen or restored. */
const known = new Map<string, { hash: string; blob: Blob }>();
const pending = new Map<string, Promise<string | null>>();

async function ensureStored(hash: string, blob: Blob) {
  const count = await idb<number>(IMAGES, "readonly", (s) => s.count(hash));
  if (!count) await idb(IMAGES, "readwrite", (s) => s.put({ hash, blob, createdAt: Date.now() } satisfies StoredImage));
}

/** The stored reference for a live image URL, storing its bytes first. */
function refFor(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  if (!url.startsWith("blob:") && !url.startsWith("data:")) return Promise.resolve(/^(https?:\/\/|\/)/.test(url) ? url : null);
  const entry = known.get(url);
  if (entry) return ensureStored(entry.hash, entry.blob).then(() => `idb:${entry.hash}`, () => null);
  let job = pending.get(url);
  if (!job) {
    job = (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        const hash = await hashBlob(blob);
        known.set(url, { hash, blob });
        await ensureStored(hash, blob);
        return `idb:${hash}`;
      } catch {
        return null;
      } finally {
        pending.delete(url);
      }
    })();
    pending.set(url, job);
  }
  return job;
}

/** A sync best guess for when the page is going away and nothing can be awaited. */
function refNow(url: string | null): string | null {
  if (!url) return null;
  const entry = known.get(url);
  if (entry) return `idb:${entry.hash}`;
  return /^(https?:\/\/|\/)/.test(url) ? url : null;
}

/** A live URL for a stored reference. Each call makes a fresh object URL: panels revoke the ones they replace. */
async function urlFor(ref: string | null): Promise<string | null> {
  if (!ref) return null;
  if (!ref.startsWith("idb:")) return ref;
  const hash = ref.slice(4);
  try {
    const stored = await idb<StoredImage | undefined>(IMAGES, "readonly", (s) => s.get(hash));
    if (!stored?.blob) return null;
    const url = URL.createObjectURL(stored.blob);
    known.set(url, { hash, blob: stored.blob });
    return url;
  } catch {
    return null;
  }
}

/** Puts restored images into settings that came back from disk without them. */
async function withImages(settings: CanSettings, images: ImageRefs): Promise<CanSettings> {
  const [artwork, background] = await Promise.all([urlFor(images.artwork), urlFor(images.background)]);
  return {
    ...settings,
    artwork: { ...settings.artwork, url: artwork, name: artwork ? settings.artwork.name : null },
    background: { ...settings.background, imageUrl: background }
  };
}

// -------------------------------------------------------------- scene state

const uiDefaults = (): SceneUi => {
  const ui = useUi.getInitialState();
  return { sceneName: ui.sceneName, exportAspect: ui.exportAspect, prompt: ui.prompt, backgroundSource: ui.backgroundSource };
};

const sceneUi = (): SceneUi => {
  const ui = useUi.getState();
  return { sceneName: ui.sceneName, exportAspect: ui.exportAspect, prompt: ui.prompt, backgroundSource: ui.backgroundSource };
};

/** The scene UI a setup carries: its name is the setup's own. */
const setupUi = ({ exportAspect, prompt, backgroundSource }: SceneUi): Setup["ui"] => ({ exportAspect, prompt, backgroundSource });

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveSeq = 0;
let dirty = false;

async function flush() {
  const seq = ++saveSeq;
  const { settings } = useEditor.getState();
  const ui = sceneUi();
  const [artwork, background] = await Promise.all([refFor(settings.artwork.url), refFor(settings.background.imageUrl)]);
  // A later save started while this one hashed images: it has newer state, let it write.
  if (seq !== saveSeq) return;
  writeLocal(SCENE_KEY, JSON.stringify(encodeScene(settings, { artwork, background }, ui)));
  dirty = false;
}

function flushNow() {
  if (!dirty) return;
  clearTimeout(saveTimer);
  saveSeq++;
  const { settings } = useEditor.getState();
  writeLocal(SCENE_KEY, JSON.stringify(encodeScene(settings, { artwork: refNow(settings.artwork.url), background: refNow(settings.background.imageUrl) }, sceneUi())));
  dirty = false;
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flush(), SAVE_DELAY);
}

let started = false;

function startAutosave() {
  if (started) return;
  started = true;
  useEditor.subscribe((state, prev) => {
    if (state.settings === prev.settings) return;
    // Hash and store new images straight away so a quick reload still finds them.
    if (state.settings.artwork.url !== prev.settings.artwork.url) void refFor(state.settings.artwork.url);
    if (state.settings.background.imageUrl !== prev.settings.background.imageUrl) void refFor(state.settings.background.imageUrl);
    scheduleSave();
  });
  useUi.subscribe((state, prev) => {
    if (state.sceneName !== prev.sceneName || state.exportAspect !== prev.exportAspect || state.prompt !== prev.prompt || state.backgroundSource !== prev.backgroundSource) scheduleSave();
  });
  addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushNow());
  // Anything that changed while the images were loading.
  scheduleSave();
}

/**
 * Restores the last scene before the first render, then starts autosaving. Resolves after at most
 * `waitMs` so a stuck IndexedDB can't hold the app back; late images are filled in when they land.
 */
export async function startPersistence(waitMs = 1500): Promise<void> {
  const scene = decodeScene(readLocal(SCENE_KEY), uiDefaults());
  if (!scene) {
    startAutosave();
    setTimeout(() => void collectGarbage(), 3000);
    return;
  }
  useEditor.setState({ settings: scene.settings, past: [], future: [] });
  useUi.setState(scene.ui);
  const images = withImages(scene.settings, scene.images)
    .then((restored) => {
      // Only fill in images the user hasn't replaced in the meantime.
      const current = useEditor.getState().settings;
      const artwork = current.artwork === scene.settings.artwork ? restored.artwork : current.artwork;
      const background = current.background === scene.settings.background ? restored.background : current.background;
      if (artwork !== current.artwork || background !== current.background) useEditor.setState({ settings: { ...current, artwork, background } });
    })
    .catch(() => undefined)
    .finally(() => {
      startAutosave();
      setTimeout(() => void collectGarbage(), 3000);
    });
  await Promise.race([images, new Promise((resolve) => setTimeout(resolve, waitMs))]);
}

// -------------------------------------------------------------------- setups

function readSetup(value: unknown): Setup | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const scene = decodeScene({ v: record.v, settings: record.settings, images: record.images, ui: { ...(record.ui as object), sceneName: record.name } }, uiDefaults());
  if (!scene || typeof record.id !== "string") return null;
  return {
    id: record.id,
    name: scene.ui.sceneName,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : 0,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
    v: SCHEMA_VERSION,
    settings: scene.settings,
    images: scene.images,
    ui: setupUi(scene.ui),
    thumbnail: record.thumbnail instanceof Blob ? record.thumbnail : null
  };
}

export async function listSetups(): Promise<Setup[]> {
  const raw = await idb<unknown[]>(SETUPS, "readonly", (s) => s.getAll());
  return raw
    .map(readSetup)
    .filter((s): s is Setup => s !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Saves the current scene under `name`. Passing an existing setup's id replaces it. */
export async function saveSetup(name: string, thumbnail: Blob | null, replace?: Setup): Promise<Setup> {
  const { settings } = useEditor.getState();
  const [artwork, background] = await Promise.all([refFor(settings.artwork.url), refFor(settings.background.imageUrl)]);
  const now = Date.now();
  const scene = encodeScene(settings, { artwork, background }, sceneUi(), now);
  const setup: Setup = {
    id: replace?.id ?? crypto.randomUUID(),
    name: name.trim().slice(0, 120) || "Untitled setup",
    createdAt: replace?.createdAt ?? now,
    updatedAt: now,
    v: scene.v,
    settings: scene.settings,
    images: scene.images,
    ui: setupUi(scene.ui),
    thumbnail
  };
  await idb(SETUPS, "readwrite", (s) => s.put(setup));
  useUi.getState().set({ sceneName: setup.name });
  return setup;
}

export async function renameSetup(setup: Setup, name: string): Promise<Setup> {
  const next = { ...setup, name: name.trim().slice(0, 120) || setup.name, updatedAt: Date.now() };
  await idb(SETUPS, "readwrite", (s) => s.put(next));
  return next;
}

export async function deleteSetup(setup: Setup): Promise<void> {
  await idb(SETUPS, "readwrite", (s) => s.delete(setup.id));
}

/** Puts a deleted setup back, for the toast's Undo. */
export async function restoreSetup(setup: Setup): Promise<void> {
  await idb(SETUPS, "readwrite", (s) => s.put(setup));
}

type Snapshot = { ui: SceneUi };

/** Applies a setup through the editor store (one undo step). Returns what the scene UI was, for Undo. */
export async function applySetup(setup: Setup): Promise<Snapshot> {
  const before = { ui: sceneUi() };
  const restored = await withImages(setup.settings, sanitizeImages(setup.images));
  const tool = useEditor.getState().settings.water.tool;
  useEditor.getState().load({ ...restored, water: { ...restored.water, tool } });
  useUi.getState().set({ sceneName: setup.name, ...setup.ui });
  return before;
}

/** Back to the default scene (one undo step). */
export function newScene(): Snapshot {
  const before = { ui: sceneUi() };
  const tool = useEditor.getState().settings.water.tool;
  useEditor.getState().load({ ...DEFAULT_SETTINGS, water: { ...DEFAULT_SETTINGS.water, tool } });
  useUi.getState().set(uiDefaults());
  return before;
}

/** Undoes `applySetup` or `newScene`: the scene through the store's undo, the scene UI from the snapshot. */
export function undoSceneChange(snapshot: Snapshot) {
  useEditor.getState().undo();
  useUi.getState().set(snapshot.ui);
}

// ------------------------------------------------------------------- cleanup

/** Deletes stored images that neither the current scene, a setup nor this session refers to. */
export async function collectGarbage(): Promise<number> {
  try {
    const keep = new Set<string>();
    const addRef = (ref: string | null) => ref?.startsWith("idb:") && keep.add(ref.slice(4));
    const scene = decodeScene(readLocal(SCENE_KEY), uiDefaults());
    if (scene) {
      addRef(scene.images.artwork);
      addRef(scene.images.background);
    }
    const setups = await idb<unknown[]>(SETUPS, "readonly", (s) => s.getAll());
    for (const setup of setups) {
      const images = sanitizeImages((setup as { images?: unknown } | null)?.images);
      addRef(images.artwork);
      addRef(images.background);
    }
    for (const { hash } of known.values()) keep.add(hash);
    const stored = await idb<StoredImage[]>(IMAGES, "readonly", (s) => s.getAll());
    const cutoff = Date.now() - GRACE_MS;
    const stale = stored.filter((image) => !keep.has(image.hash) && !(image.createdAt > cutoff));
    for (const image of stale) await idb(IMAGES, "readwrite", (s) => s.delete(image.hash));
    return stale.length;
  } catch {
    return 0;
  }
}

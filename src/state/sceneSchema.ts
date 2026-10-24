// What a saved scene looks like on disk, and how stored data is read back safely. Pure: no
// browser APIs, so the rules are unit-tested. The CanSettings shape changes between builds,
// so nothing stored is trusted: it is merged over the current defaults key by key.

import {
  DEFAULT_SETTINGS,
  type ArtworkFit,
  type ArtworkMode,
  type BackgroundFit,
  type BackgroundKind,
  type CanSettings,
  type ColorPreset,
  type EnvironmentPreset,
  type Finish,
  type FocusTarget,
  type GradePreset,
  type InkMode,
  type LabelStock,
  type RimSide
} from "../engine/settings";
import type { BackgroundSource } from "./ui";

/** Bump when a stored field changes meaning, and add a step to MIGRATIONS. */
export const SCHEMA_VERSION = 1;

/** One step per version: MIGRATIONS[n] turns version n data into version n + 1. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, Migration> = {};

/** The UI state that belongs to a scene. Dialogs, toasts, generation status and undo do not. */
export interface SceneUi {
  sceneName: string;
  exportAspect: [number, number];
  prompt: string;
  backgroundSource: BackgroundSource;
}

/**
 * Images are stored apart from the settings: `idb:<sha>` points at bytes in IndexedDB; any other
 * string is a plain URL (http or same-origin) kept as is. Object and data URLs never reach disk.
 */
export interface ImageRefs {
  artwork: string | null;
  background: string | null;
}

export interface SceneData {
  settings: CanSettings;
  images: ImageRefs;
  ui: SceneUi;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const has = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const HEX = /^#[0-9a-f]{6}$/i;

function sameKind(fallback: unknown, value: unknown): boolean {
  if (typeof fallback === "number") return typeof value === "number" && Number.isFinite(value);
  if (typeof fallback === "string") return typeof value === "string" && (!HEX.test(fallback) || HEX.test(value));
  return typeof value === typeof fallback;
}

/** What a field whose default is null may hold: null, a primitive, or a list of numbers (a point). */
function nullableValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return Array.isArray(value) && value.every((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * Deep-merges stored data over the defaults: only keys the defaults have survive, each with the
 * default's type (or null where the default is null); everything else falls back to the default.
 */
export function mergeOver<T>(defaults: T, stored: unknown): T {
  if (defaults === null) return (nullableValue(stored) ? stored : null) as T;
  if (Array.isArray(defaults)) {
    const ok = Array.isArray(stored) && stored.length === defaults.length && stored.every((v, i) => sameKind(defaults[i], v));
    return (ok ? [...(stored as unknown[])] : defaults) as T;
  }
  if (isRecord(defaults)) {
    if (!isRecord(stored)) return defaults;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(defaults)) out[key] = has(stored, key) ? mergeOver(defaults[key], stored[key]) : defaults[key];
    return out as T;
  }
  return (sameKind(defaults, stored) ? stored : defaults) as T;
}

// Fields with a fixed set of values. The Record types make the compiler flag any value added to
// or removed from these unions, so a stale stored value can never reach the renderer.
const options = <T extends string>(values: Record<T, true>) => Object.keys(values) as T[];
const PRESETS = options<ColorPreset>({ silver: true, gold: true, black: true, white: true, custom: true });
const FINISHES = options<Finish>({ gloss: true, satin: true, matte: true, brushed: true });
const ENUMS: [string, string, readonly string[]][] = [
  ["body", "preset", PRESETS],
  ["body", "finish", FINISHES],
  ["lid", "preset", PRESETS],
  ["lid", "finish", FINISHES],
  ["artwork", "mode", options<ArtworkMode>({ printed: true, label: true, sticker: true })],
  ["artwork", "fit", options<ArtworkFit>({ auto: true, wrap: true, aspect: true })],
  ["artwork", "ink", options<InkMode>({ opaque: true, translucent: true })],
  ["artwork", "labelStock", options<LabelStock>({ paper: true, film: true })],
  ["lighting", "rimSide", options<RimSide>({ opposite: true, left: true, right: true })],
  ["lighting", "environment", options<EnvironmentPreset>({ softbox: true, hard: true, daylight: true, golden: true, bar: true, overcast: true })],
  ["effects", "focus", options<FocusTarget>({ label: true, lid: true, point: true })],
  ["effects", "grade", options<GradePreset>({ neutral: true, crisp: true, warm: true, cool: true, film: true, mono: true, custom: true })],
  ["background", "kind", options<BackgroundKind>({ studio: true, solid: true, gradient: true, image: true })],
  ["background", "fit", options<BackgroundFit>({ fill: true, fit: true })]
];
const SOURCES = options<BackgroundSource>({ generate: true, upload: true, colour: true });

/** Settings → what is written to disk: the same shape, minus live URLs and the water tool mode. */
export function storableSettings(settings: CanSettings): CanSettings {
  return {
    ...settings,
    artwork: { ...settings.artwork, url: null },
    water: { ...settings.water, tool: DEFAULT_SETTINGS.water.tool },
    background: { ...settings.background, imageUrl: null }
  };
}

/** Stored settings → settings the stage can render. Image URLs and the water tool mode are not restored. */
export function sanitizeSettings(stored: unknown): CanSettings {
  const merged = mergeOver(DEFAULT_SETTINGS, stored) as unknown as Record<string, Record<string, unknown>>;
  for (const [section, key, allowed] of ENUMS) {
    const fallback = (DEFAULT_SETTINGS as unknown as Record<string, Record<string, unknown>>)[section]?.[key];
    if (isRecord(merged[section]) && has(merged[section], key) && !allowed.includes(merged[section][key] as string)) {
      merged[section] = { ...merged[section], [key]: fallback };
    }
  }
  return storableSettings(merged as unknown as CanSettings);
}

const IDB_REF = /^idb:[0-9a-f]{16,128}$/;
const URL_REF = /^(https?:\/\/|\/)[^\s]*$/;

export function isImageRef(value: unknown): value is string {
  return typeof value === "string" && value.length < 4096 && (IDB_REF.test(value) || URL_REF.test(value));
}

export function sanitizeImages(stored: unknown): ImageRefs {
  const value = isRecord(stored) ? stored : {};
  return { artwork: isImageRef(value.artwork) ? value.artwork : null, background: isImageRef(value.background) ? value.background : null };
}

export function sanitizeUi(stored: unknown, defaults: SceneUi): SceneUi {
  const ui = mergeOver(defaults, stored);
  const name = ui.sceneName.trim().slice(0, 120);
  return {
    sceneName: name || defaults.sceneName,
    exportAspect: ui.exportAspect.every((n) => n > 0 && n < 100) ? ui.exportAspect : defaults.exportAspect,
    prompt: ui.prompt.slice(0, 2000),
    backgroundSource: SOURCES.includes(ui.backgroundSource) ? ui.backgroundSource : defaults.backgroundSource
  };
}

/** Brings stored data up to the current version. Null when the version is missing or invalid. */
export function migrate(data: Record<string, unknown>, migrations: Record<number, Migration> = MIGRATIONS, target = SCHEMA_VERSION): Record<string, unknown> | null {
  let version = data.v;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return null;
  let current = data;
  while (version < target) {
    const step = migrations[version];
    if (step) current = step(current);
    version += 1;
  }
  // Data from a newer build merges like any other: unknown keys drop, known keys keep their values.
  return { ...current, v: Math.max(version, target) };
}

/** Reads a stored scene. Null for anything missing, corrupted or unreadable: callers keep defaults. */
export function decodeScene(raw: unknown, uiDefaults: SceneUi): SceneData | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(data)) return null;
  try {
    const current = migrate(data);
    if (!current) return null;
    return { settings: sanitizeSettings(current.settings), images: sanitizeImages(current.images), ui: sanitizeUi(current.ui, uiDefaults) };
  } catch {
    return null;
  }
}

export interface StoredScene {
  v: number;
  savedAt: number;
  settings: CanSettings;
  images: ImageRefs;
  ui: SceneUi;
}

export function encodeScene(settings: CanSettings, images: ImageRefs, ui: SceneUi, now = Date.now()): StoredScene {
  return { v: SCHEMA_VERSION, savedAt: now, settings: storableSettings(settings), images, ui };
}

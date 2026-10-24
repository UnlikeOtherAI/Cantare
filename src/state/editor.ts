import { create } from "zustand";
import { DEFAULT_SETTINGS, type CanSettings } from "../engine/settings";

type Section = { [K in keyof CanSettings]: CanSettings[K] extends object ? K : never }[keyof CanSettings];

interface Options {
  /** False for mode switches (water tool) that should not land on the undo stack. */
  history?: boolean;
}

interface EditorStore {
  settings: CanSettings;
  past: CanSettings[];
  future: CanSettings[];
  set<K extends keyof CanSettings>(key: K, value: CanSettings[K], options?: Options): void;
  patch<K extends Section>(key: K, value: Partial<CanSettings[K]>, options?: Options): void;
  undo(): void;
  redo(): void;
}

const LIMIT = 80;
// Changes closer together than this (a slider drag) are one undo step.
const GROUP_MS = 600;
let lastCommit = 0;

function commit(state: EditorStore, next: CanSettings, options?: Options): Partial<EditorStore> {
  if (options?.history === false) return { settings: next };
  const now = performance.now();
  const grouped = now - lastCommit < GROUP_MS;
  lastCommit = now;
  return {
    settings: next,
    past: grouped ? state.past : [...state.past.slice(-LIMIT), state.settings],
    future: []
  };
}

export const useEditor = create<EditorStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  past: [],
  future: [],
  set: (key, value, options) => set((state) => commit(state, { ...state.settings, [key]: value }, options)),
  patch: (key, value, options) =>
    set((state) => commit(state, { ...state.settings, [key]: { ...(state.settings[key] as object), ...value } }, options)),
  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return {};
      lastCommit = 0;
      // The water tool is a mode, not a change: keep the current one.
      return { settings: { ...previous, water: { ...previous.water, tool: state.settings.water.tool } }, past: state.past.slice(0, -1), future: [state.settings, ...state.future] };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      lastCommit = 0;
      return { settings: { ...next, water: { ...next.water, tool: state.settings.water.tool } }, past: [...state.past, state.settings], future: state.future.slice(1) };
    })
}));

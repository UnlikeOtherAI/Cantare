import { create } from "zustand";
import { DEFAULT_SETTINGS, type CanSettings } from "../engine/settings";

type Section = Exclude<keyof CanSettings, "formatId" | "lidRotation" | "spin">;

interface EditorStore {
  settings: CanSettings;
  set<K extends keyof CanSettings>(key: K, value: CanSettings[K]): void;
  patch<K extends Section>(key: K, value: Partial<CanSettings[K]>): void;
  reset(): void;
}

export const useEditor = create<EditorStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  set: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
  patch: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: { ...state.settings[key], ...value } } })),
  reset: () => set({ settings: DEFAULT_SETTINGS })
}));

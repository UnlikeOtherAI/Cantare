import { create } from "zustand";
import type { StageInfo, ViewInfo } from "../engine/stage";
import type { CameraPreset } from "../engine/settings";

export type Tool = "can" | "colour" | "artwork" | "light" | "water" | "camera" | "effects" | "background";
export const TOOLS: Tool[] = ["can", "colour", "artwork", "light", "water", "camera", "effects", "background"];
export type Sheet = "peek" | "half" | "full";
export type Dialog = "export" | "gallery" | "setups" | "save-setup" | null;
export type BackgroundSource = "generate" | "upload" | "colour";
export type GenerationState = { status: "idle" } | { status: "generating"; startedAt: number } | { status: "error"; message: string };

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "danger";
  action?: { label: string; run: () => void };
}

interface UiStore {
  tool: Tool;
  sheet: Sheet;
  collapsed: boolean;
  dialog: Dialog;
  toast: Toast | null;
  welcome: boolean;
  ready: boolean;
  info: StageInfo | null;
  view: ViewInfo;
  angle: CameraPreset | null;
  turntable: boolean;
  backgroundSource: BackgroundSource;
  generation: GenerationState;
  prompt: string;
  galleryCount: number;
  /** null while checking the server. */
  generationAvailable: boolean | null;
  exportAspect: [number, number];
  sceneName: string;
  /** Effects: the next tap on the stage sets the focus point. */
  pickingFocus: boolean;
  setTool(tool: Tool): void;
  set(patch: Partial<UiStore>): void;
  showToast(toast: Omit<Toast, "id">): void;
}

const WELCOME_KEY = "cantare.welcomed";

function welcomed() {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberWelcomed() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // Private mode: the card simply comes back next time.
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiStore>((set, get) => ({
  tool: "light",
  sheet: "half",
  collapsed: false,
  dialog: null,
  toast: null,
  welcome: !welcomed(),
  ready: false,
  info: null,
  view: { elevation: 15, focalLength: 70 },
  angle: "three-quarter",
  turntable: false,
  backgroundSource: "generate",
  generation: { status: "idle" },
  prompt: "",
  galleryCount: 0,
  generationAvailable: null,
  exportAspect: [4, 5],
  sceneName: "Untitled scene",
  pickingFocus: false,
  setTool: (tool) => {
    const { sheet } = get();
    set({ tool, collapsed: false, sheet: sheet === "peek" ? "half" : sheet, pickingFocus: false });
  },
  set: (patch) => set(patch),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast: { ...toast, id: Date.now() } });
    toastTimer = setTimeout(() => set({ toast: null }), 5000);
  }
}));

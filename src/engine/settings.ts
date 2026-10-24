// Everything the stage renders, as plain data. The UI store holds one of these and the
// stage diff-applies it. Camera position is view state and lives outside it.

export type ColorPreset = "silver" | "gold" | "black" | "white" | "custom";
export type Finish = "gloss" | "satin" | "matte" | "brushed";
export type ArtworkMode = "printed" | "label";
export type InkMode = "opaque" | "translucent";
export type LabelStock = "paper" | "film";
export type EnvironmentPreset = "softbox" | "hard" | "daylight" | "golden" | "bar" | "overcast";
export type RimSide = "opposite" | "left" | "right";
export type BackgroundKind = "studio" | "solid" | "gradient" | "image";
export type BackgroundFit = "fill" | "fit";
export type WaterTool = "none" | "brush" | "spray" | "erase";
export type CameraPreset = "front" | "three-quarter" | "top" | "hero";
export type FocusTarget = "label" | "lid" | "point";
export type GradePreset = "neutral" | "crisp" | "warm" | "cool" | "film" | "mono" | "custom";

export interface PartAppearance {
  preset: ColorPreset;
  /** Hex colour used when `preset` is `custom`. */
  color: string;
  /** Custom colours only: metallic (tinted aluminium) or painted. */
  metallic: boolean;
  finish: Finish;
}

export interface ArtworkSettings {
  /** Object URL or data URL of the uploaded artwork. */
  url: string | null;
  name: string | null;
  mode: ArtworkMode;
  ink: InkMode;
  labelStock: LabelStock;
  /** Label only: fraction of the circumference covered; null wraps the whole can. */
  wrap: number | null;
  /** Artwork height in mm; null infers it from the image and the can's template. */
  height: number | null;
  /** Vertical shift in mm from the default placement. */
  offset: number;
  /** Rotation of the artwork around the can, degrees. */
  rotation: number;
}

export interface LightingSettings {
  /** Key light direction relative to the camera: 0 = from the camera, 90 = from the right. */
  azimuth: number;
  /** Degrees above the horizon. */
  elevation: number;
  intensity: number;
  /** 0 = small hard source, 1 = large soft source. */
  softness: number;
  /** Colour temperature in kelvin. */
  temperature: number;
  rimEnabled: boolean;
  rim: number;
  rimSide: RimSide;
  environment: EnvironmentPreset;
  /** Degrees; turns the reflections around the can. */
  envRotation: number;
  /** Reflect the background photo in the can instead of the studio walls. */
  matchBackground: boolean;
}

export interface WaterSettings {
  /** 0..1 droplet coverage for the scatter. */
  density: number;
  /** 0..1 droplet size. */
  size: number;
  /** 0..1 how readily heavy drops run down. */
  runs: number;
  /** 0..1 condensation haze. */
  haze: number;
  seed: number;
  tool: WaterTool;
  /** Brush diameter in mm. */
  brush: number;
  /** 0..1 water laid down per stroke step. */
  flow: number;
}

export interface EffectSettings {
  dofEnabled: boolean;
  /** f-number: smaller is a shallower focus. */
  aperture: number;
  focus: FocusTarget;
  focusPoint: [number, number, number] | null;
  bloomEnabled: boolean;
  bloom: number;
  bloomThreshold: number;
  vignetteEnabled: boolean;
  vignette: number;
  grainEnabled: boolean;
  grain: number;
  grainSize: number;
  gradeEnabled: boolean;
  grade: GradePreset;
  /** Exposure in EV stops. */
  exposure: number;
  /** -1..1 */
  contrast: number;
  saturation: number;
  warmth: number;
  groundEnabled: boolean;
  shadow: number;
  shadowSoftness: number;
  reflection: number;
  /** 0..1: how quickly the floor reflection fades. */
  reflectionFade: number;
}

export interface BackgroundSettings {
  kind: BackgroundKind;
  color: string;
  color2: string;
  /** Gradient angle in degrees; 180 = top to bottom. */
  angle: number;
  imageUrl: string | null;
  fit: BackgroundFit;
  /** 0..1 */
  blur: number;
  /** Hide the backdrop on the stage without losing it. */
  visible: boolean;
}

export interface CanSettings {
  formatId: string;
  body: PartAppearance;
  lid: PartAppearance;
  /** Degrees; turns the lid (and tab) independently of the artwork. */
  lidRotation: number;
  artwork: ArtworkSettings;
  lighting: LightingSettings;
  water: WaterSettings;
  effects: EffectSettings;
  background: BackgroundSettings;
  /** Degrees; spins the can on its own axis. */
  spin: number;
  /** Lens focal length in mm (full-frame equivalent). */
  focalLength: number;
}

export const DEFAULT_SETTINGS: CanSettings = {
  formatId: "eu-std-330",
  body: { preset: "silver", color: "#c8102e", metallic: false, finish: "gloss" },
  lid: { preset: "silver", color: "#1a1a1a", metallic: true, finish: "brushed" },
  lidRotation: 0,
  artwork: { url: null, name: null, mode: "printed", ink: "opaque", labelStock: "paper", wrap: null, height: null, offset: 0, rotation: 0 },
  lighting: {
    azimuth: -40,
    elevation: 30,
    intensity: 1,
    softness: 0.6,
    temperature: 5600,
    rimEnabled: true,
    rim: 0.7,
    rimSide: "opposite",
    environment: "softbox",
    envRotation: 0,
    matchBackground: true
  },
  water: { density: 0, size: 0.4, runs: 0.3, haze: 0, seed: 1, tool: "none", brush: 24, flow: 0.6 },
  effects: {
    dofEnabled: false,
    aperture: 4,
    focus: "label",
    focusPoint: null,
    bloomEnabled: true,
    bloom: 0.2,
    bloomThreshold: 0.8,
    vignetteEnabled: true,
    vignette: 0.3,
    grainEnabled: true,
    grain: 0.12,
    grainSize: 0.4,
    gradeEnabled: true,
    grade: "neutral",
    exposure: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    groundEnabled: true,
    shadow: 0.75,
    shadowSoftness: 0.5,
    reflection: 0,
    reflectionFade: 0.45
  },
  background: { kind: "studio", color: "#34373c", color2: "#0f1012", angle: 180, imageUrl: null, fit: "fill", blur: 0, visible: true },
  spin: 0,
  focalLength: 70
};

export const GRADE_PRESETS: Record<Exclude<GradePreset, "custom">, Pick<EffectSettings, "contrast" | "saturation" | "warmth">> = {
  neutral: { contrast: 0, saturation: 0, warmth: 0 },
  crisp: { contrast: 0.18, saturation: 0.08, warmth: 0 },
  warm: { contrast: 0.06, saturation: 0.05, warmth: 0.35 },
  cool: { contrast: 0.06, saturation: 0, warmth: -0.35 },
  film: { contrast: -0.08, saturation: -0.18, warmth: 0.12 },
  mono: { contrast: 0.12, saturation: -1, warmth: 0 }
};

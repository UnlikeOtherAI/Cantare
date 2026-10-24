// Everything the stage renders, as plain data. The UI store holds one of these and the
// stage diff-applies it.

export type ColorPreset = "silver" | "gold" | "black" | "white" | "custom";
export type Finish = "gloss" | "satin" | "matte" | "brushed";
export type ArtworkMode = "printed" | "label";
export type InkMode = "opaque" | "translucent";
export type LabelStock = "paper" | "film";
export type EnvironmentPreset = "studio" | "strips" | "warm" | "daylight" | "noir";
export type BackgroundKind = "studio" | "solid" | "gradient" | "image" | "transparent";
export type WaterTool = "none" | "spray" | "spread" | "wipe";
export type CameraPreset = "front" | "three-quarter" | "top" | "hero";

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
  mode: ArtworkMode;
  ink: InkMode;
  labelStock: LabelStock;
  /** Artwork height in mm; null infers it from the image and the can's template. */
  height: number | null;
  /** Vertical shift in mm from the default placement. */
  offset: number;
  /** Rotation of the artwork around the can, degrees. */
  rotation: number;
}

export interface LightingSettings {
  /** Key light direction: degrees around the can (0 = camera side) and above the horizon. */
  azimuth: number;
  elevation: number;
  intensity: number;
  /** 0 = small hard source, 1 = large soft source. */
  softness: number;
  /** Colour temperature in kelvin. */
  temperature: number;
  rim: number;
  environment: EnvironmentPreset;
  exposure: number;
}

export interface WaterSettings {
  /** 0..1 droplet coverage for the scatter. */
  density: number;
  /** 0..1 droplet size. */
  size: number;
  /** 0..1 condensation haze. */
  haze: number;
  seed: number;
  tool: WaterTool;
  /** Brush radius in mm. */
  brush: number;
}

export interface EffectSettings {
  depthOfField: number;
  bloom: number;
  vignette: number;
  grain: number;
  contrast: number;
  saturation: number;
  /** -1 cool .. 1 warm grade. */
  warmth: number;
  shadow: number;
  reflection: number;
}

export interface BackgroundSettings {
  kind: BackgroundKind;
  color: string;
  color2: string;
  imageUrl: string | null;
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
}

export const DEFAULT_SETTINGS: CanSettings = {
  formatId: "eu-std-440",
  body: { preset: "silver", color: "#c8102e", metallic: false, finish: "gloss" },
  lid: { preset: "silver", color: "#1a1a1a", metallic: true, finish: "gloss" },
  lidRotation: 0,
  artwork: { url: null, mode: "printed", ink: "opaque", labelStock: "paper", height: null, offset: 0, rotation: 0 },
  lighting: { azimuth: -38, elevation: 28, intensity: 1, softness: 0.6, temperature: 5600, rim: 0.7, environment: "studio", exposure: 1 },
  water: { density: 0, size: 0.5, haze: 0, seed: 1, tool: "none", brush: 14 },
  effects: { depthOfField: 0, bloom: 0.25, vignette: 0.3, grain: 0.15, contrast: 0.05, saturation: 0, warmth: 0, shadow: 0.7, reflection: 0 },
  background: { kind: "studio", color: "#16171a", color2: "#3a3d44", imageUrl: null },
  spin: 0
};

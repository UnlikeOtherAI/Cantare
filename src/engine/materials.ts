import * as THREE from "three";
import type { Finish, PartAppearance } from "./settings";

export interface SurfaceSpec {
  /** sRGB hex. */
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  anisotropy: number;
}

// Metals are tinted aluminium (colour is the reflectance tint); the others are paint.
// Starting values follow docs/can-reference.md section 10. Silver is bare aluminium's
// reflectance, slightly below pure white so highlights still have somewhere to go; gold
// is a warm champagne lacquer over it rather than brass.
const PRESETS = {
  silver: { color: "#e8eaec", metal: true },
  gold: { color: "#ecc98c", metal: true },
  black: { color: "#0e0e10", metal: false },
  white: { color: "#f3f3f0", metal: false }
} as const;

// Can aluminium is drawn metal under a clear lacquer: the metal itself is fairly rough,
// so reflections of the set blur into soft gradients, and the lacquer on top gives the
// crisp specular edge. Paint and ink keep a glossier dielectric response.
const FINISH: Record<Finish, { metal: [number, number, number]; paint: [number, number, number]; anisotropy: number }> = {
  // [roughness, clearcoat, clearcoatRoughness]
  gloss: { metal: [0.27, 0.85, 0.06], paint: [0.32, 1, 0.035], anisotropy: 0 },
  satin: { metal: [0.36, 0.4, 0.22], paint: [0.48, 0.5, 0.22], anisotropy: 0 },
  matte: { metal: [0.52, 0, 0.5], paint: [0.78, 0, 0.5], anisotropy: 0 },
  brushed: { metal: [0.36, 0.3, 0.1], paint: [0.45, 0.6, 0.1], anisotropy: 0.75 }
};

export function surfaceSpec(part: PartAppearance): SurfaceSpec {
  const preset = part.preset === "custom" ? { color: part.color, metal: part.metallic } : PRESETS[part.preset];
  const finish = FINISH[part.finish];
  const [roughness, clearcoat, clearcoatRoughness] = preset.metal ? finish.metal : finish.paint;
  return {
    color: preset.color,
    metalness: preset.metal ? 1 : 0,
    roughness,
    clearcoat,
    clearcoatRoughness,
    anisotropy: preset.metal ? finish.anisotropy : 0
  };
}

export function applySurface(material: THREE.MeshPhysicalMaterial, spec: SurfaceSpec, withMaps = false) {
  // With maps, colour/metalness/roughness come from the decoration textures.
  if (!withMaps) {
    material.color.set(spec.color);
    material.metalness = spec.metalness;
    material.roughness = spec.roughness;
  } else {
    material.color.set("#ffffff");
    material.metalness = 1;
    material.roughness = 1;
  }
  material.clearcoat = spec.clearcoat;
  material.clearcoatRoughness = spec.clearcoatRoughness;
  material.anisotropy = spec.anisotropy;
  material.needsUpdate = true;
}

/** Ink and label materials keep a dielectric response; this returns the finish part. */
export function finishValues(finish: Finish, metal: boolean) {
  const [roughness, clearcoat, clearcoatRoughness] = metal ? FINISH[finish].metal : FINISH[finish].paint;
  return { roughness, clearcoat, clearcoatRoughness };
}

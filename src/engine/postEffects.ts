// The photographic finish: exposure, white balance, bloom, tone mapping, grade, vignette
// and grain. The live view and the path-traced final render each own a set, configured
// from the same settings so both look alike.

import * as THREE from "three";
import { BloomEffect, BrightnessContrastEffect, Effect, HueSaturationEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import type { EffectSettings } from "./settings";

// Exposure and white balance before tone mapping.
export class GradeEffect extends Effect {
  constructor() {
    super(
      "GradeEffect",
      `uniform float exposure;
      uniform float warmth;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exposure;
        c *= vec3(1.0 + warmth * 0.07, 1.0 + warmth * 0.01, 1.0 - warmth * 0.08);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ["exposure", new THREE.Uniform(1)],
          ["warmth", new THREE.Uniform(0)]
        ])
      }
    );
  }
}

// Luminance film grain after tone mapping, with a grain size in output pixels.
export class GrainEffect extends Effect {
  constructor() {
    super(
      "GrainEffect",
      `uniform float amount;
      uniform float grainSize;
      uniform vec2 pixels;
      float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 cell = floor(uv * pixels / grainSize);
        float n = hash(cell) + hash(cell + 17.13) - 1.0;
        float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float weight = amount * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));
        outputColor = vec4(inputColor.rgb + n * weight * 0.07, inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ["amount", new THREE.Uniform(0)],
          ["grainSize", new THREE.Uniform(1)],
          ["pixels", new THREE.Uniform(new THREE.Vector2(1, 1))]
        ])
      }
    );
  }
  override setSize(width: number, height: number) {
    (this.uniforms.get("pixels")!.value as THREE.Vector2).set(width, height);
  }
}

export interface PostEffects {
  grade: GradeEffect;
  bloom: BloomEffect;
  tone: ToneMappingEffect;
  contrast: BrightnessContrastEffect;
  saturation: HueSaturationEffect;
  vignette: VignetteEffect;
  grain: GrainEffect;
}

export function createPostEffects(): PostEffects {
  return {
    grade: new GradeEffect(),
    bloom: new BloomEffect({ intensity: 0.4, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.62 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    contrast: new BrightnessContrastEffect(),
    saturation: new HueSaturationEffect(),
    vignette: new VignetteEffect({ offset: 0.32, darkness: 0.3 }),
    grain: new GrainEffect()
  };
}

/** In the order they apply. */
export function postEffectList(post: PostEffects): Effect[] {
  return [post.grade, post.bloom, post.tone, post.contrast, post.saturation, post.vignette, post.grain];
}

export function configurePost(post: PostEffects, fx: EffectSettings) {
  post.bloom.intensity = fx.bloomEnabled ? fx.bloom * 1.6 : 0;
  post.bloom.luminanceMaterial.threshold = 0.4 + fx.bloomThreshold * 0.55;
  post.vignette.darkness = fx.vignetteEnabled ? fx.vignette * 0.75 : 0;
  post.grain.uniforms.get("amount")!.value = fx.grainEnabled ? fx.grain : 0;
  post.grain.uniforms.get("grainSize")!.value = 1 + fx.grainSize * 2.5;
  const grade = fx.gradeEnabled;
  post.grade.uniforms.get("exposure")!.value = grade ? Math.pow(2, fx.exposure) : 1;
  post.grade.uniforms.get("warmth")!.value = grade ? fx.warmth : 0;
  post.contrast.contrast = grade ? fx.contrast * 0.5 : 0;
  post.saturation.saturation = grade ? fx.saturation * (fx.saturation < 0 ? 1 : 0.6) : 0;
}

export function disposePostEffects(post: PostEffects) {
  for (const effect of postEffectList(post)) effect.dispose();
}

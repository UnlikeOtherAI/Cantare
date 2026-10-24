// The final render's main-thread half. The can is path traced in a worker (real
// reflections, soft self-shadowing and bounce light) and laid over a raster plate that
// carries the backdrop, floor shadow, floor reflection and the water. The live view's
// photographic finish then runs over the combined image.
//
// The path tracer's own "matte" floor goes fully transparent and catches no shadows, so
// the floor's shadow and reflection come from the plate instead.

import * as THREE from "three";
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { configurePost, createPostEffects, disposePostEffects, postEffectList } from "./postEffects";
import type { EffectSettings } from "./settings";

/**
 * Lay the traced can (premultiplied alpha) over the plate, bring the plate's water back
 * through `water` (a coverage mask, or null for a dry can), and run the photographic
 * finish, drawing to the renderer's canvas.
 */
export function compositeAndFinish(renderer: THREE.WebGLRenderer, plate: THREE.Texture, traced: THREE.Texture, water: THREE.Texture | null, fx: EffectSettings) {
  const size = renderer.getSize(new THREE.Vector2());
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: { plate: { value: plate }, traced: { value: traced }, water: { value: water }, hasWater: { value: water ? 1 : 0 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D plate;
      uniform sampler2D traced;
      uniform sampler2D water;
      uniform float hasWater;
      varying vec2 vUv;
      void main() {
        vec4 p = texture2D(plate, vUv);
        vec4 t = texture2D(traced, vUv);
        vec4 c = vec4(t.rgb + p.rgb * (1.0 - t.a), t.a + p.a * (1.0 - t.a));
        float w = hasWater > 0.5 ? texture2D(water, vUv).r : 0.0;
        gl_FragColor = mix(c, p, w);
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const scene = new THREE.Scene();
  scene.add(quad);

  const post = createPostEffects();
  configurePost(post, fx);
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, ...postEffectList(post)));
  composer.setSize(size.x, size.y);
  composer.render();

  composer.dispose();
  disposePostEffects(post);
  material.dispose();
  quad.geometry.dispose();
}

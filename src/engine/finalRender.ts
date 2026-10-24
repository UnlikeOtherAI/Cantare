// The final render: the can is path traced (real reflections, refraction through the
// droplets, soft self-shadowing and bounce light) and composited over a raster plate
// that carries the backdrop, floor shadow and floor reflection. The live view's
// photographic finish then runs over the combined image.
//
// The path tracer's own "matte" floor goes fully transparent and catches no shadows, so
// the floor's shadow and reflection come from the plate instead.

import * as THREE from "three";
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { PhysicalCamera, WebGLPathTracer } from "three-gpu-pathtracer";
import { configurePost, createPostEffects, disposePostEffects, postEffectList } from "./postEffects";
import type { EffectSettings } from "./settings";

/** Bake an environment scene into a cube map the path tracer can sample. */
export function captureEnvironment(renderer: THREE.WebGLRenderer, envScene: THREE.Scene, size = 1024): THREE.WebGLCubeRenderTarget {
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const camera = new THREE.CubeCamera(0.1, 100, target);
  camera.update(renderer, envScene);
  return target;
}

export type TraceStage = "preparing" | "tracing";

export interface TraceOptions {
  samples: number;
  onStage?(stage: TraceStage): void;
  /** f-number; null renders everything sharp. */
  fStop: number | null;
  focusDistance: number;
  onProgress?(samples: number, total: number): void;
  signal?: AbortSignal;
}

// Yield to the event loop without waiting for an animation frame, which browsers pause
// in background tabs: a long render keeps going if the user switches away.
const nextFrame = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

// One tracer per renderer, kept between renders: compiling its shader is the slow part
// (over a minute on some integrated GPUs), and it only recompiles when the scene's
// material layout changes.
const tracers = new WeakMap<THREE.WebGLRenderer, WebGLPathTracer>();

function tracerFor(renderer: THREE.WebGLRenderer): WebGLPathTracer {
  let tracer = tracers.get(renderer);
  if (tracer) return tracer;
  tracer = new WebGLPathTracer(renderer);
  tracer.renderToCanvas = false;
  tracer.dynamicLowRes = false;
  tracer.minSamples = 0;
  tracer.renderDelay = 0;
  tracer.fadeDuration = 0;
  tracer.bounces = 10;
  tracer.transmissiveBounces = 12;
  tracer.filterGlossyFactor = 0.35;
  tracer.multipleImportanceSampling = true;
  tracers.set(renderer, tracer);
  return tracer;
}

export function disposeTracer(renderer: THREE.WebGLRenderer) {
  tracers.get(renderer)?.dispose();
  tracers.delete(renderer);
}

/**
 * Path trace `scene` from `camera` at the renderer's current size. The returned tracer
 * is shared: read `target.texture` before the next render, and do not dispose it.
 */
export async function pathTrace(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, options: TraceOptions): Promise<WebGLPathTracer> {
  const lens = new PhysicalCamera();
  lens.copy(camera);
  // Match the live view's 24 mm sensor height so the f-number means the same thing.
  lens.filmGauge = 24 * Math.max(camera.aspect, 1);
  lens.fStop = options.fStop ?? 64;
  lens.focusDistance = options.focusDistance;
  lens.apertureBlades = 7;
  lens.updateProjectionMatrix();

  const tracer = tracerFor(renderer);
  const size = renderer.getSize(new THREE.Vector2());
  // Smaller tiles keep each GPU submission short at large sizes.
  const tiles = Math.max(1, Math.ceil(Math.max(size.x, size.y) / 1400));
  tracer.tiles.set(tiles, tiles);
  options.onStage?.("preparing");
  await nextFrame();
  const t0 = performance.now();
  tracer.setScene(scene, lens);
  const t1 = performance.now();

  // Compile the tracing shader without freezing the page (parallel shader compile).
  const material = (tracer as unknown as { _pathTracer: { material: THREE.Material } })._pathTracer.material;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  // Status queries block until the driver finishes; skip them for this huge shader.
  const checks = renderer.debug.checkShaderErrors;
  renderer.debug.checkShaderErrors = false;
  await renderer.compileAsync(quad, new THREE.OrthographicCamera());
  renderer.debug.checkShaderErrors = checks;
  quad.geometry.dispose();
  const t2 = performance.now();
  options.onStage?.("tracing");

  let last = performance.now();
  let first = 0;
  while (tracer.samples < options.samples) {
    if (options.signal?.aborted) throw new DOMException("Render cancelled", "AbortError");
    tracer.renderSample();
    if (!first) {
      first = performance.now();
      if (import.meta.env.DEV) console.info(`final render: scene ${Math.round(t1 - t0)} ms, compile ${Math.round(t2 - t1)} ms, first sample ${Math.round(first - t2)} ms`);
    }
    // Yield so the page stays responsive and progress can paint.
    if (performance.now() - last > 40) {
      options.onProgress?.(Math.floor(tracer.samples), options.samples);
      await nextFrame();
      last = performance.now();
    }
  }
  options.onProgress?.(options.samples, options.samples);
  return tracer;
}

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

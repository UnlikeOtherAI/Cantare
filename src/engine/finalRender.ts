// Path tracing for the final render. Worker-safe: no DOM, no post-processing. The can
// is traced in a worker (see traceWorker.ts) so the minute-long shader compile on some
// GPUs never freezes the page; finalComposite.ts lays the result over the raster plate.

import * as THREE from "three";
import { PhysicalCamera, WebGLPathTracer } from "three-gpu-pathtracer";

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

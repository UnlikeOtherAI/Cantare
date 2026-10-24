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
  /** Phones: smaller GPU submissions (iOS kills long ones) and fewer bounces. */
  mobile?: boolean;
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
// (tens of seconds on some integrated GPUs). three.js caches a compiled program by
// its defines and by the render target it was compiled for, so the tracer must only
// ever compile the variant it renders with (float target, linear output).

interface TracerInternals {
  _pathTracer: {
    material: THREE.ShaderMaterial & { setDefine(name: string, value: unknown): boolean };
    target: THREE.WebGLRenderTarget;
    isCompiling: boolean;
    compileMaterial(): Promise<unknown>;
    _fsQuad: { _mesh: THREE.Mesh };
  };
}

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
  tracer.filterGlossyFactor = 0.35;
  tracer.multipleImportanceSampling = true;
  const inner = (tracer as unknown as TracerInternals)._pathTracer;
  // The tracer compiles in the background whenever a define changes, but with no
  // render target bound: a screen-output variant it never renders with. Compile the
  // float-target variant it actually uses instead.
  inner.compileMaterial = () => {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(inner.target);
    const compiling = renderer.compileAsync(inner._fsQuad._mesh, new THREE.OrthographicCamera());
    renderer.setRenderTarget(previous);
    return compiling;
  };
  // Scenes here never have fog; set it now so the first scene does not flip it and
  // throw away a compile.
  inner.material.setDefine("FEATURE_FOG", 0);
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
  // Smaller tiles keep each GPU submission short. Mobile GPUs get much smaller ones:
  // iOS resets a WebGL context whose work runs too long in one go.
  const tiles = Math.max(options.mobile ? 2 : 1, Math.ceil(Math.max(size.x, size.y) / (options.mobile ? 600 : 1400)));
  tracer.tiles.set(tiles, tiles);
  // A can needs few bounces; glass-like water would need more, but water is raster.
  tracer.bounces = options.mobile ? 6 : 10;
  tracer.transmissiveBounces = options.mobile ? 4 : 8;
  options.onStage?.("preparing");
  await nextFrame();
  const t0 = performance.now();
  tracer.setScene(scene, lens);
  const t1 = performance.now();
  // Wait for the tracer's own compile (a no-op when this variant is already cached).
  const inner = (tracer as unknown as TracerInternals)._pathTracer;
  while (inner.isCompiling) {
    if (options.signal?.aborted) throw new DOMException("Render cancelled", "AbortError");
    await new Promise((r) => setTimeout(r, 100));
  }
  const t2 = performance.now();
  options.onStage?.("tracing");

  // renderSample only queues GPU work. Without a sync point the whole render would be
  // queued in a moment: progress would read 100% while the GPU was still at the start,
  // and a long queue is what makes drivers reset (Windows) or kill the page (iOS).
  // A fence per pass keeps one pass in flight and makes the progress real.
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const gpuDone = async (fence: WebGLSync | null) => {
    if (!fence) return;
    gl.flush();
    while (gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) {
      if (options.signal?.aborted) break;
      await new Promise((r) => setTimeout(r, 4));
    }
    gl.deleteSync(fence);
  };

  let last = performance.now();
  let first = 0;
  while (tracer.samples < options.samples) {
    if (options.signal?.aborted) throw new DOMException("Render cancelled", "AbortError");
    tracer.renderSample();
    await gpuDone(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));
    if (!first) {
      first = performance.now();
      if (import.meta.env.DEV) console.info(`final render: scene ${Math.round(t1 - t0)} ms, compile ${Math.round(t2 - t1)} ms, first pass ${Math.round(first - t2)} ms`);
    }
    if (performance.now() - last > 100) {
      options.onProgress?.(Math.floor(tracer.samples), options.samples);
      await nextFrame();
      last = performance.now();
    }
  }
  options.onProgress?.(options.samples, options.samples);
  return tracer;
}

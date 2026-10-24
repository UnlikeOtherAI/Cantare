// Path traces the can off the main thread on an OffscreenCanvas. One renderer and one
// tracer live for the worker's lifetime, so the slow shader compile happens once.

import * as THREE from "three";
import { buildEnvironmentScene } from "./environment";
import { captureEnvironment, pathTrace } from "./finalRender";
import type { LightingSettings } from "./settings";
import { restoreScene, type SceneSnapshot } from "./traceScene";

export interface TraceRequest {
  type: "render";
  id: number;
  width: number;
  height: number;
  samples: number;
  scene: SceneSnapshot;
  lighting: LightingSettings;
  photo: ImageBitmap | null;
  environmentRotation: [number, number, number];
  camera: { position: number[]; quaternion: number[]; fov: number; aspect: number; near: number; far: number };
  fStop: number | null;
  focusDistance: number;
}

export type TraceMessage =
  | { type: "stage"; id: number; stage: "preparing" | "tracing" }
  | { type: "progress"; id: number; samples: number; total: number }
  | { type: "done"; id: number; width: number; height: number; pixels: Uint16Array }
  | { type: "error"; id: number; message: string; cancelled?: boolean };

let renderer: THREE.WebGLRenderer | null = null;
const cancelled = new Set<number>();

function rendererFor(width: number, height: number) {
  if (!renderer) {
    const canvas = new OffscreenCanvas(width, height);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
  }
  renderer.setSize(width, height, false);
  return renderer;
}

const post = (message: TraceMessage, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(message, transfer);

async function render(request: TraceRequest) {
  const { id, width, height } = request;
  const gl = rendererFor(width, height);
  const { group, dispose } = restoreScene(request.scene);
  const scene = new THREE.Scene();
  scene.add(group);

  // Matte floor: invisible to the camera, there for bounce light and reflections.
  const floorMaterial = new THREE.MeshStandardMaterial({ color: "#8c8c8c", roughness: 0.55 });
  (floorMaterial as THREE.MeshStandardMaterial & { matte: boolean }).matte = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const envScene = buildEnvironmentScene(request.lighting, request.photo);
  const environment = captureEnvironment(gl, envScene);
  envScene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.MeshBasicMaterial | undefined;
    material?.map?.dispose();
    material?.dispose?.();
  });
  request.photo?.close();
  scene.environment = environment.texture;
  scene.environmentRotation.set(...request.environmentRotation);

  const c = request.camera;
  const camera = new THREE.PerspectiveCamera(c.fov, c.aspect, c.near, c.far);
  camera.position.fromArray(c.position);
  camera.quaternion.fromArray(c.quaternion);
  camera.updateMatrixWorld(true);

  const abort = new AbortController();
  const watch = setInterval(() => cancelled.has(id) && abort.abort(), 50);
  try {
    const tracer = await pathTrace(gl, scene, camera, {
      samples: request.samples,
      fStop: request.fStop,
      focusDistance: request.focusDistance,
      signal: abort.signal,
      onStage: (stage) => post({ type: "stage", id, stage }),
      onProgress: (samples, total) => post({ type: "progress", id, samples, total })
    });

    // Read back in strips and pack to half floats: a full float32 copy of a large
    // render would not fit comfortably in memory on phones.
    const pixels = new Uint16Array(width * height * 4);
    const rows = Math.max(1, Math.floor((1 << 22) / (width * 4)));
    const strip = new Float32Array(width * rows * 4);
    for (let y = 0; y < height; y += rows) {
      const h = Math.min(rows, height - y);
      gl.readRenderTargetPixels(tracer.target, 0, y, width, h, strip);
      const offset = y * width * 4;
      for (let i = 0; i < width * h * 4; i++) pixels[offset + i] = THREE.DataUtils.toHalfFloat(Math.min(strip[i], 65000));
    }
    post({ type: "done", id, width, height, pixels }, [pixels.buffer]);
  } catch (error) {
    const isCancel = error instanceof DOMException && error.name === "AbortError";
    post({ type: "error", id, message: error instanceof Error ? error.message : String(error), cancelled: isCancel });
  } finally {
    clearInterval(watch);
    cancelled.delete(id);
    dispose();
    floor.geometry.dispose();
    floorMaterial.dispose();
    environment.dispose();
  }
}

// One job at a time: jobs share the renderer and the tracer.
let queue = Promise.resolve();

self.onmessage = (event: MessageEvent<TraceRequest | { type: "cancel"; id: number }>) => {
  const message = event.data;
  if (message.type === "cancel") cancelled.add(message.id);
  else queue = queue.then(() => render(message));
};

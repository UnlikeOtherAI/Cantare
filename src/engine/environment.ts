// Procedural studio environments. Reflections are what sell metal, so the key light is
// a real softbox in the environment map: moving the light moves its reflection too.

import * as THREE from "three";
import type { BackgroundSettings, LightingSettings } from "./settings";

/** Approximate blackbody colour (Tanner Helland's fit), linear-ish RGB in 0..1. */
export function kelvinToColor(kelvin: number): THREE.Color {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  // Normalise so 6500 K is neutral white.
  const color = new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
  const ref = new THREE.Color().setRGB(1, 0.976, 0.995, THREE.SRGBColorSpace);
  return new THREE.Color(color.r / ref.r, color.g / ref.g, color.b / ref.b);
}

export function lightDirection(azimuth: number, elevation: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

function panel(width: number, height: number, color: THREE.Color, intensity: number, position: THREE.Vector3) {
  const material = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.copy(position);
  mesh.lookAt(0, 0, 0);
  return mesh;
}

function room(top: THREE.Color, bottom: THREE.Color, horizon?: THREE.Color) {
  const geometry = new THREE.SphereGeometry(20, 48, 24);
  const colors: number[] = [];
  const pos = geometry.attributes.position;
  const mid = horizon ?? top.clone().lerp(bottom, 0.5);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20;
    const c = y > 0 ? mid.clone().lerp(top, Math.pow(y, 0.7)) : mid.clone().lerp(bottom, Math.pow(-y, 0.4));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  mesh.userData.room = true;
  return mesh;
}

/**
 * Wrap a flat background photo round the can as a rough equirectangular panorama, so
 * the metal reflects the scene it is composited into. Blurred: it only has to carry
 * colour and brightness, not detail.
 */
function photoRoom(image: HTMLImageElement): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  ctx.filter = "blur(10px)";
  // Sky and floor: stretch the top and bottom strips of the photo.
  ctx.drawImage(image, 0, 0, iw, ih * 0.08, -20, -20, 1064, 170);
  ctx.drawImage(image, 0, ih * 0.92, iw, ih * 0.08, -20, 362, 1064, 170);
  // Horizon band: the photo, mirrored so the wrap has no hard seam.
  ctx.drawImage(image, 0, 128, 512, 256);
  ctx.save();
  ctx.translate(1024, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(image, 0, 128, 512, 256);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }));
  mesh.userData.room = true;
  return mesh;
}

/**
 * Build the environment in camera space: +Z points at the camera, +X is screen right.
 * The stage turns it with the camera each frame, so lights stay where the user put them
 * relative to the view, like a camera-and-lights rig orbiting a turntable.
 */
export function buildEnvironmentScene(lighting: LightingSettings, backdrop: HTMLImageElement | null = null): THREE.Scene {
  const scene = new THREE.Scene();
  // Fills, walls and cards turn with the environment rotation; the key and rim do not.
  const set = new THREE.Group();
  set.rotation.y = THREE.MathUtils.degToRad(lighting.envRotation);
  scene.add(set);

  const warm = kelvinToColor(lighting.temperature);
  const key = lightDirection(lighting.azimuth, lighting.elevation);
  const keyIntensity = 9 * lighting.intensity;
  const size = 1.2 + lighting.softness * 4.2;
  const at = (dir: THREE.Vector3, distance = 6) => dir.clone().normalize().multiplyScalar(distance);
  const dir = (az: number, el: number) => lightDirection(az, el);
  const white = new THREE.Color(1, 1, 1);
  const black = new THREE.Color(0, 0, 0);

  switch (lighting.environment) {
    case "softbox": {
      // A product studio: grey sweep, white V-flats and cards, black flags between them
      // and an overhead scrim. Bare metal needs those bright and dark bands to read as
      // silver rather than as a dark mirror.
      set.add(room(new THREE.Color(0.32, 0.32, 0.33), new THREE.Color(0.06, 0.06, 0.065), new THREE.Color(0.2, 0.2, 0.21)));
      set.add(panel(3.2, 7, white, 1.6, at(dir(55, 4), 7)));
      set.add(panel(1.4, 7, black, 1, at(dir(22, 4), 6.5)));
      set.add(panel(size * 2.2, 7, warm, 1.1 + keyIntensity * 0.05, at(dir(lighting.azimuth + 180, 8), 7)));
      set.add(panel(4.5, 7, white, 0.9, at(dir(-95, 5), 7)));
      set.add(panel(5, 3, white, 2.2, new THREE.Vector3(0, 6, 0.5)));
      scene.add(panel(size, size * 1.35, warm, keyIntensity, at(key)));
      break;
    }
    case "hard": {
      set.add(room(new THREE.Color(0.03, 0.03, 0.032), new THREE.Color(0.006, 0.006, 0.007)));
      set.add(panel(0.5, 6.5, white, 3, at(dir(lighting.azimuth + 180, 5))));
      scene.add(panel(0.45 + lighting.softness * 0.9, 0.6 + lighting.softness * 1.2, warm, keyIntensity * 2.6, at(key)));
      break;
    }
    case "daylight": {
      set.add(room(new THREE.Color(0.75, 0.85, 1.05), new THREE.Color(0.18, 0.16, 0.13), new THREE.Color(0.9, 0.9, 0.92)));
      scene.add(panel(0.35 + lighting.softness * 1.4, 0.35 + lighting.softness * 1.4, kelvinToColor(Math.max(lighting.temperature, 5000)), keyIntensity * 6, at(key, 10)));
      break;
    }
    case "golden": {
      set.add(room(new THREE.Color(0.35, 0.42, 0.62), new THREE.Color(0.12, 0.07, 0.04), new THREE.Color(1.1, 0.55, 0.25)));
      scene.add(panel(0.5 + lighting.softness * 1.6, 0.5 + lighting.softness * 1.6, kelvinToColor(Math.min(lighting.temperature, 3300)), keyIntensity * 5, at(key, 10)));
      break;
    }
    case "bar": {
      const amber = kelvinToColor(2700);
      set.add(room(new THREE.Color(0.06, 0.04, 0.025), new THREE.Color(0.02, 0.012, 0.008), new THREE.Color(0.09, 0.055, 0.03)));
      for (let i = 0; i < 14; i++) {
        set.add(panel(0.25, 0.25, amber, 14, at(dir(i * 25.7 + 40, 4 + ((i * 37) % 23)), 8)));
      }
      scene.add(panel(size, size * 1.2, warm, keyIntensity, at(key)));
      break;
    }
    case "overcast": {
      set.add(room(new THREE.Color(0.95, 0.97, 1.0), new THREE.Color(0.2, 0.2, 0.2), new THREE.Color(0.6, 0.62, 0.65)));
      scene.add(panel(size * 2, size * 2, warm, keyIntensity * 0.25, at(key)));
      break;
    }
  }

  if (lighting.rimEnabled && lighting.rim > 0) {
    const sides = lighting.rimSide === "opposite" ? [lighting.azimuth + 180] : lighting.rimSide === "left" ? [-125] : [125];
    for (const az of sides) scene.add(panel(0.55, 6, white, 9 * lighting.rim, at(dir(az, 6))));
  }

  if (backdrop) {
    for (const child of set.children.filter((c) => c.userData.room)) set.remove(child);
    set.add(photoRoom(backdrop));
  }
  return scene;
}

/**
 * Paint the backdrop at the viewport's aspect: studio sweep, solid, angled gradient, or
 * a photo filled or fitted with optional blur.
 */
export function paintBackdrop(bg: BackgroundSettings, image: HTMLImageElement | null, aspect: number): HTMLCanvasElement {
  const long = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = aspect >= 1 ? long : Math.round(long * aspect);
  canvas.height = aspect >= 1 ? Math.round(long / aspect) : long;
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d")!;

  if (bg.kind === "image" && image) {
    ctx.fillStyle = "#0d0e10";
    ctx.fillRect(0, 0, w, h);
    const scale = bg.fit === "fill" ? Math.max(w / image.naturalWidth, h / image.naturalHeight) : Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const blur = bg.blur * 0.02 * Math.max(w, h);
    if (blur > 0.5) ctx.filter = `blur(${blur}px)`;
    // Overdraw by the blur radius so blurred edges do not fade to the fill colour.
    const pad = bg.fit === "fill" ? blur * 2 : 0;
    ctx.drawImage(image, (w - dw) / 2 - pad, (h - dh) / 2 - pad, dw + pad * 2, dh + pad * 2);
    ctx.filter = "none";
    return canvas;
  }

  if (bg.kind === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
    return canvas;
  }

  if (bg.kind === "gradient") {
    const a = THREE.MathUtils.degToRad(bg.angle);
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
    const g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    g.addColorStop(0, bg.color);
    g.addColorStop(1, bg.color2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return canvas;
  }

  // Studio sweep: lighter behind the can, falling off to the floor and the corners.
  ctx.fillStyle = bg.color2;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.32, 0, w * 0.5, h * 0.32, Math.max(w, h) * 0.75);
  glow.addColorStop(0, bg.color);
  glow.addColorStop(1, bg.color2);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const floor = ctx.createLinearGradient(0, h * 0.62, 0, h);
  floor.addColorStop(0, "rgba(0,0,0,0)");
  floor.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  return canvas;
}

/**
 * Guess the key light from a photo: the brightest region gives the direction (left/right
 * and how high), its colour the temperature.
 */
export function estimateLight(image: HTMLImageElement): { azimuth: number; elevation: number; temperature: number } {
  const w = 48;
  const h = Math.max(8, Math.round((w * image.naturalHeight) / image.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lum: number[] = [];
  for (let i = 0; i < w * h; i++) lum.push(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]);
  const threshold = [...lum].sort((a, b) => b - a)[Math.floor(lum.length * 0.04)];
  let sx = 0;
  let sy = 0;
  let r = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] < threshold) continue;
    sx += i % w;
    sy += Math.floor(i / w);
    r += data[i * 4];
    b += data[i * 4 + 2];
    n++;
  }
  const cx = sx / n / w;
  const cy = sy / n / h;
  const ratio = (r + 1) / (b + 1);
  return {
    azimuth: Math.round((cx - 0.5) * 150),
    elevation: Math.round(THREE.MathUtils.clamp(10 + (1 - cy) * 60, 5, 75)),
    temperature: Math.round(THREE.MathUtils.clamp(6500 - (ratio - 1) * 3500, 2700, 8000) / 100) * 100
  };
}

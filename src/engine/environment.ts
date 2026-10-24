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

/**
 * A gentle colour cast: `amount` 0 is white, 1 is the full hue. The result keeps unit
 * luminance, so tinting a source changes its colour and not its brightness.
 */
export function cast(hue: THREE.Color, amount: number): THREE.Color {
  const c = new THREE.Color(1, 1, 1).lerp(hue, THREE.MathUtils.clamp(amount, 0, 1));
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c.multiplyScalar(1 / Math.max(lum, 1e-4));
}

/**
 * Key light colour for a temperature. A camera is white-balanced close to its key, so
 * the slider shifts the look warm or cool gently instead of painting the subject.
 */
export function keyColor(kelvin: number): THREE.Color {
  return cast(kelvinToColor(kelvin), 0.42);
}

const WHITE = new THREE.Color(1, 1, 1);
const BLACK = new THREE.Color(0, 0, 0);
const grey = (v: number) => new THREE.Color(v, v, v);

function panel(width: number, height: number, color: THREE.Color, intensity: number, position: THREE.Vector3) {
  const material = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.copy(position);
  mesh.lookAt(0, 0, 0);
  return mesh;
}

/**
 * The walls, ceiling and floor as a graded sphere: `horizon` is what the side of a can
 * mostly reflects, so it sets the metal's mid-tone.
 */
function room(top: THREE.Color, horizon: THREE.Color, bottom: THREE.Color) {
  const geometry = new THREE.SphereGeometry(20, 48, 24);
  const colors: number[] = [];
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20;
    const c = y > 0 ? horizon.clone().lerp(top, Math.pow(y, 0.8)) : horizon.clone().lerp(bottom, Math.pow(-y, 0.45));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  mesh.userData.room = true;
  return mesh;
}

/** A background photo: an element in the page, a bitmap in the final-render worker. */
export type Photo = HTMLImageElement | ImageBitmap;

/**
 * Wrap a flat background photo round the can as a rough equirectangular panorama, so
 * the metal picks up the scene it is composited into. Blurred and largely desaturated:
 * it should read as a hint of the surroundings, not as a colour wash over the can. The
 * studio's own lights stay on top of it.
 */
function photoRoom(image: Photo): THREE.Mesh {
  // OffscreenCanvas when there is no DOM: the final render builds this in a worker.
  const canvas = typeof document === "undefined" ? new OffscreenCanvas(1024, 512) : Object.assign(document.createElement("canvas"), { width: 1024, height: 512 });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const iw = "naturalWidth" in image ? image.naturalWidth : image.width;
  const ih = "naturalHeight" in image ? image.naturalHeight : image.height;
  ctx.filter = "blur(14px)";
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
  ctx.filter = "none";
  // Pull most of the chroma out and the contrast down.
  ctx.globalCompositeOperation = "saturation";
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#6a6c6e";
  ctx.fillRect(0, 0, 1024, 512);
  // The floor is darker than the photo suggests: the can stands on the bottom of it.
  ctx.globalAlpha = 1;
  const floor = ctx.createLinearGradient(0, 300, 0, 512);
  floor.addColorStop(0, "rgba(0,0,0,0)");
  floor.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 300, 1024, 212);
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
 *
 * Each preset is a product-photography setup, white-balanced to its key: the colour of
 * the set shows in highlights, reflections of the surroundings and the dark side of the
 * can, never as a wash over the whole body. Every setup keeps both bright and dark
 * bands in the horizon, because bare metal needs that contrast to read as metal.
 */
export function buildEnvironmentScene(lighting: LightingSettings, backdrop: Photo | null = null): THREE.Scene {
  const scene = new THREE.Scene();
  // Fills, walls and cards turn with the environment rotation; the key and rim do not.
  const set = new THREE.Group();
  set.rotation.y = THREE.MathUtils.degToRad(lighting.envRotation);
  scene.add(set);

  const keyTint = keyColor(lighting.temperature);
  const keyDir = lightDirection(lighting.azimuth, lighting.elevation);
  const keyIntensity = 9 * lighting.intensity;
  const size = 1.2 + lighting.softness * 4.2;
  const at = (dir: THREE.Vector3, distance = 6) => dir.clone().normalize().multiplyScalar(distance);
  const dir = (az: number, el: number) => lightDirection(az, el);
  const behind = lighting.azimuth + 180;
  // Azimuths relative to the key: `across(x)` is x degrees from the key towards and past
  // the camera (where the side of the can reflects things), `beyond(x)` further round
  // behind the key. Fills and flags then follow the key round the can.
  const side = lighting.azimuth >= 0 ? 1 : -1;
  const across = (deg: number) => lighting.azimuth - side * deg;
  const beyond = (deg: number) => lighting.azimuth + side * deg;
  // A vertical cylinder seen from slightly above reflects what lies around and a little
  // below the horizon, so a key raised above the can leaves the body unlit. The strip
  // box beside the key, floor-standing and tall, is what draws the highlight down it.
  const strip = (scale: number, width = 0.6) => panel(size * width, 7, keyTint, keyIntensity * scale, at(dir(lighting.azimuth, -2), 6.5));

  switch (lighting.environment) {
    case "softbox": {
      // Product studio: grey sweep, white V-flat fill, black flag beside the key for the
      // dark band, a white strip behind the can for the edge and an overhead scrim.
      set.add(room(grey(0.3), grey(0.2), grey(0.05)));
      set.add(panel(3.2, 7, WHITE, 1.5, at(dir(across(95), 4), 7)));
      set.add(panel(1.3, 7, BLACK, 1, at(dir(across(22), 4), 6.5)));
      set.add(panel(4.5, 7, WHITE, 0.85, at(dir(beyond(55), 5), 7)));
      set.add(panel(size * 2.2, 7, WHITE, 1.05 + keyIntensity * 0.05, at(dir(behind, 8), 7)));
      set.add(panel(5, 3, WHITE, 2.1, new THREE.Vector3(0, 6, 0.5)));
      scene.add(panel(size, size * 1.35, keyTint, keyIntensity, at(keyDir)));
      break;
    }
    case "hard": {
      // One small hard head in a dark studio, a narrow strip for the far edge and a grey
      // card across from the key so the shadow side keeps some shape.
      set.add(room(grey(0.05), grey(0.04), grey(0.01)));
      set.add(panel(0.5, 6.5, WHITE, 3, at(dir(behind, 5))));
      set.add(panel(2.6, 7, grey(0.42), 1, at(dir(across(100), 4), 7)));
      scene.add(strip(0.35, 0.3));
      scene.add(panel(0.45 + lighting.softness * 0.9, 0.6 + lighting.softness * 1.2, keyTint, keyIntensity * 2.6, at(keyDir)));
      break;
    }
    case "daylight": {
      // A room with a tall window as the key: pale walls, sky through the window side,
      // a darker doorway across from it and a warm-grey floor bouncing light back up.
      const sky = cast(new THREE.Color(0.7, 0.8, 1), 0.3);
      const floor = cast(new THREE.Color(1, 0.85, 0.65), 0.2);
      set.add(room(sky.clone().multiplyScalar(0.6), grey(0.42), floor.clone().multiplyScalar(0.16)));
      set.add(panel(3, 7, grey(0.12), 1, at(dir(across(110), 4), 7)));
      set.add(panel(2.5, 7, grey(0.6), 1, at(dir(beyond(70), 6), 7)));
      set.add(panel(6, 4, floor, 0.3, at(dir(across(40), -22), 7)));
      const window = 1.4 + lighting.softness * 2.6;
      scene.add(panel(window, window * 1.8, sky.clone().lerp(keyTint, 0.5), keyIntensity * 0.55, at(keyDir, 6.5)));
      break;
    }
    case "golden": {
      // Low sun outdoors: a small hot key, sunlit ground and haze glowing on the sun's
      // side, a cool sky above and a dark ground. Warmth lives in the highlight and that
      // low glow; the mid-tones stay grey.
      const sun = cast(kelvinToColor(3400), 0.7);
      const sky = cast(new THREE.Color(0.55, 0.7, 1), 0.28);
      const glow = cast(new THREE.Color(1, 0.6, 0.3), 0.45);
      set.add(room(sky.clone().multiplyScalar(0.5), cast(glow, 0.3).multiplyScalar(0.28), new THREE.Color(0.1, 0.085, 0.072)));
      set.add(panel(10, 3.5, glow, 0.62, at(dir(lighting.azimuth, -10), 9)));
      set.add(panel(4, 7, BLACK, 1, at(dir(across(120), 4), 7)));
      set.add(panel(3, 6, sky, 0.55, at(dir(beyond(70), 8), 7)));
      scene.add(panel(0.5 + lighting.softness * 1.6, 0.5 + lighting.softness * 1.6, sun.lerp(keyTint, 0.3), keyIntensity * 4.5, at(keyDir, 10)));
      break;
    }
    case "bar": {
      // Night interior: a softbox key with its strip, a dark wood room, the bar top
      // bouncing the key back up, a row of warm lamps on the back bar for the bokeh in
      // the edges, and a cool tube by the door for the far side.
      const lamp = cast(kelvinToColor(2600), 0.7);
      const wood = cast(new THREE.Color(1, 0.7, 0.45), 0.35);
      set.add(room(wood.clone().multiplyScalar(0.04), wood.clone().multiplyScalar(0.13), wood.clone().multiplyScalar(0.05)));
      for (let i = 0; i < 7; i++) set.add(panel(0.4, 0.4, lamp, 9, at(dir(behind - 54 + i * 18, 9 + (i % 2) * 5), 8)));
      set.add(panel(0.45, 5, cast(new THREE.Color(0.75, 0.85, 1), 0.35), 2.2, at(dir(across(115), 5), 7)));
      set.add(panel(8, 3, wood, 0.4, at(dir(across(30), -18), 7)));
      set.add(panel(3, 6, wood, 0.3, at(dir(beyond(80), 6), 7)));
      set.add(panel(1.6, 7, BLACK, 1, at(dir(across(22), 3), 6.5)));
      scene.add(strip(0.5));
      scene.add(panel(size, size * 1.3, keyTint, keyIntensity, at(keyDir)));
      break;
    }
    case "overcast": {
      // A white sky dome, a dark ground, and dark masses at the horizon either side so
      // the metal keeps its bands.
      set.add(room(grey(0.8), grey(0.5), grey(0.08)));
      set.add(panel(4, 4, grey(0.08), 1, at(dir(across(85), 6), 7)));
      set.add(panel(4, 4, grey(0.1), 1, at(dir(beyond(70), 6), 7)));
      scene.add(panel(size * 2, size * 2, keyTint, keyIntensity * 0.4, at(keyDir)));
      break;
    }
  }

  if (lighting.rimEnabled && lighting.rim > 0) {
    const sides = lighting.rimSide === "opposite" ? [behind] : lighting.rimSide === "left" ? [-125] : [125];
    for (const az of sides) scene.add(panel(0.55, 6, WHITE, 9 * lighting.rim, at(dir(az, 6))));
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

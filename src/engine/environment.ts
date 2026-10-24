// Procedural studio environments. Reflections are what sell metal, so the key light is
// a real softbox in the environment map: moving the light moves its reflection too.

import * as THREE from "three";
import type { LightingSettings } from "./settings";

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
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}

export function buildEnvironmentScene(lighting: LightingSettings): THREE.Scene {
  const scene = new THREE.Scene();
  const warm = kelvinToColor(lighting.temperature);
  const key = lightDirection(lighting.azimuth, lighting.elevation);
  const keyIntensity = 9 * lighting.intensity;
  const size = 1.2 + lighting.softness * 4.2;
  const at = (dir: THREE.Vector3, distance = 6) => dir.clone().normalize().multiplyScalar(distance);
  const around = (deg: number, elev: number) => lightDirection(lighting.azimuth + deg, elev);
  const white = new THREE.Color(1, 1, 1);
  const rim = lighting.rim;

  switch (lighting.environment) {
    case "studio": {
      // A product studio: grey sweep, big key, white V-flats and cards for fill, black
      // flags between them, rim strips and an overhead scrim. Bare metal needs those
      // bright and dark bands to read as silver rather than as a dark mirror.
      scene.add(room(new THREE.Color(0.32, 0.32, 0.33), new THREE.Color(0.06, 0.06, 0.065), new THREE.Color(0.2, 0.2, 0.21)));
      scene.add(panel(size, size * 1.35, warm, keyIntensity, at(key)));
      scene.add(panel(3.2, 7, white, 1.6, at(around(55, 4), 7)));
      scene.add(panel(1.4, 7, new THREE.Color(0, 0, 0), 1, at(around(22, 4), 6.5)));
      scene.add(panel(size * 2.2, 7, warm, 1.1 + keyIntensity * 0.05, at(around(140, 8), 7)));
      scene.add(panel(4.5, 7, white, 0.9, at(around(-95, 5), 7)));
      scene.add(panel(0.6, 6, white, 9 * rim, at(around(115, 6))));
      scene.add(panel(0.6, 6, white, 7.5 * rim, at(around(-120, 6))));
      scene.add(panel(5, 3, white, 2.2, new THREE.Vector3(0, 6, 0.5)));
      break;
    }
    case "strips": {
      scene.add(room(new THREE.Color(0.012, 0.012, 0.014), new THREE.Color(0.004, 0.004, 0.005)));
      scene.add(panel(0.7 + lighting.softness * 0.8, 6.5, warm, keyIntensity * 1.1, at(key.clone().setY(0.15))));
      scene.add(panel(0.5, 6.5, white, 6.5 * rim, at(around(180, 5))));
      scene.add(panel(0.35, 6.5, white, 4 * rim, at(around(95, 5))));
      scene.add(panel(0.35, 6.5, white, 4 * rim, at(around(-95, 5))));
      break;
    }
    case "warm": {
      const amber = kelvinToColor(2700);
      scene.add(room(new THREE.Color(0.06, 0.04, 0.025), new THREE.Color(0.02, 0.012, 0.008), new THREE.Color(0.09, 0.055, 0.03)));
      scene.add(panel(size, size * 1.2, warm, keyIntensity, at(key)));
      for (let i = 0; i < 14; i++) {
        const dir = lightDirection(i * 25.7 + 40, 4 + ((i * 37) % 23));
        scene.add(panel(0.25, 0.25, amber, 14, at(dir, 8)));
      }
      scene.add(panel(0.5, 5, amber, 5 * rim, at(around(160, 10))));
      break;
    }
    case "daylight": {
      scene.add(room(new THREE.Color(0.75, 0.85, 1.05), new THREE.Color(0.18, 0.16, 0.13), new THREE.Color(0.9, 0.9, 0.92)));
      scene.add(panel(0.35 + lighting.softness * 1.4, 0.35 + lighting.softness * 1.4, kelvinToColor(5200), keyIntensity * 6, at(key, 10)));
      scene.add(panel(0.5, 5, white, 3 * rim, at(around(160, 10))));
      break;
    }
    case "noir": {
      scene.add(room(new THREE.Color(0.004, 0.004, 0.005), new THREE.Color(0.001, 0.001, 0.001)));
      scene.add(panel(size * 0.8, size * 1.4, warm, keyIntensity * 1.2, at(key)));
      scene.add(panel(0.25, 6, white, 5 * rim, at(around(165, 4))));
      break;
    }
  }
  return scene;
}

/** A soft vertical studio-sweep backdrop for the default background. */
export function studioBackdrop(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const linear = ctx.createLinearGradient(0, 0, 0, 512);
  linear.addColorStop(0, top);
  linear.addColorStop(0.62, bottom);
  linear.addColorStop(1, top);
  ctx.fillStyle = linear;
  ctx.fillRect(0, 0, 512, 512);
  const glow = ctx.createRadialGradient(256, 300, 10, 256, 300, 340);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function solidBackdrop(color: string, color2?: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  if (color2) {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, color);
    g.addColorStop(1, color2);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillRect(0, 0, 16, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

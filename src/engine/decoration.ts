// Artwork placement and the body's colour / roughness-metalness textures.
//
// Body UVs: u wraps the circumference with u = 0 facing the camera, v is arc length
// along the profile (mm) divided by the total arc. Printed artwork is laid out in arc
// length so it follows the heel and shoulder the way a can printed before necking does.

import * as THREE from "three";
import type { CanFormat } from "./formats";
import { finishValues, type SurfaceSpec } from "./materials";
import { arcAtHeight, type CanLandmarks, type ProfilePoint } from "./profile";
import type { ArtworkSettings, Finish } from "./settings";

export interface ArtworkPlacement {
  /** Printed: arc length (mm) of the bottom edge. Label/sticker: height (mm) of the bottom edge. */
  bottom: number;
  /** Printed: arc length (mm). Label/sticker: height (mm). */
  height: number;
  /** Fraction of the circumference the artwork covers; 1 = full wrap. */
  wrap: number;
  /** Edges in mm above the foot, as the sliders show them. */
  top: number;
  base: number;
  /** Where the edges may go for this mode. */
  range: { low: number; high: number };
  /** True when the image matches the supplier's print template for this can. */
  fromTemplate: boolean;
  /** True when the width was stretched round the can rather than kept in proportion. */
  stretched: boolean;
}

/** Below this mismatch, "auto" stretches artwork round the can instead of leaving a gap. */
const AUTO_STRETCH = 0.12;

export function artworkRange(mode: ArtworkSettings["mode"], landmarks: CanLandmarks) {
  // Printed ink runs from the foot to the lip; labels and stickers only fit the flat barrel.
  return mode === "printed" ? { low: 0, high: landmarks.neckTop - 0.2 } : { low: landmarks.heelTop + 0.5, high: landmarks.shoulderStart - 0.5 };
}

export function placeArtwork(
  format: CanFormat,
  landmarks: CanLandmarks,
  body: ProfilePoint[],
  arcs: number[],
  aspect: number,
  settings: ArtworkSettings
): ArtworkPlacement {
  const circumference = Math.PI * format.bodyDiameter;
  const range = artworkRange(settings.mode, landmarks);
  const span = range.high - range.low;
  const sticker = settings.mode === "sticker";
  // Stickers default to a centred patch half the barrel tall.
  const defaultBottom = sticker ? range.low + span * 0.25 : range.low;
  const defaultTop = sticker ? range.high - span * 0.25 : range.high;
  const base = Math.min(range.high - 4, Math.max(range.low, settings.bottom ?? defaultBottom));
  const top = Math.min(range.high, Math.max(base + 4, settings.top ?? defaultTop));

  const printed = settings.mode === "printed";
  const bottom = printed ? arcAtHeight(body, arcs, base) : base;
  const height = printed ? arcAtHeight(body, arcs, top) - bottom : top - base;

  const proportional = height * aspect;
  const mismatch = Math.abs(proportional / circumference - 1);
  const fit = settings.fit === "auto" ? (sticker || mismatch > AUTO_STRETCH ? "aspect" : "wrap") : settings.fit;
  const width = fit === "wrap" ? circumference : Math.min(circumference, proportional);

  const template = format.artwork;
  const fromTemplate = Boolean(printed && template && Math.abs(aspect - template.width / template.height) / (template.width / template.height) < 0.06);
  return { bottom, height, wrap: width / circumference, top, base, range, fromTemplate, stretched: fit === "wrap" && mismatch > 0.005 };
}

export interface BodyTextures {
  color: THREE.CanvasTexture;
  orm: THREE.CanvasTexture;
}

/**
 * Paint the body's base coat and, for printed cans, the artwork. The ORM texture uses
 * three.js channels: G = roughness, B = metalness.
 */
export function paintBody(
  target: { color: HTMLCanvasElement; orm: HTMLCanvasElement },
  width: number,
  totalArc: number,
  circumference: number,
  base: SurfaceSpec,
  bodyFinish: Finish,
  artwork: { image: CanvasImageSource; placement: ArtworkPlacement; settings: ArtworkSettings } | null
) {
  const height = Math.max(64, Math.round((width * totalArc) / circumference));
  for (const canvas of [target.color, target.orm]) {
    canvas.width = width;
    canvas.height = height;
  }
  const color = target.color.getContext("2d")!;
  const orm = target.orm.getContext("2d")!;

  color.fillStyle = base.color;
  color.fillRect(0, 0, width, height);
  orm.fillStyle = `rgb(255,${Math.round(base.roughness * 255)},${Math.round(base.metalness * 255)})`;
  orm.fillRect(0, 0, width, height);

  if (artwork && artwork.settings.mode === "printed") {
    const { placement, settings, image } = artwork;
    const w = placement.wrap * width;
    const h = (placement.height / totalArc) * height;
    const y = (1 - (placement.bottom + placement.height) / totalArc) * height;
    const centre = ((settings.rotation % 360) / 360) * width;

    const translucent = settings.ink === "translucent" && base.metalness > 0.5;
    const ink = finishValues(bodyFinish, translucent);
    const mask = document.createElement("canvas");
    mask.width = Math.max(1, Math.round(w));
    mask.height = Math.max(1, Math.round(h));
    const maskCtx = mask.getContext("2d")!;
    maskCtx.drawImage(image, 0, 0, mask.width, mask.height);
    maskCtx.globalCompositeOperation = "source-in";
    maskCtx.fillStyle = `rgb(255,${Math.round(ink.roughness * 255)},${translucent ? 255 : 0})`;
    maskCtx.fillRect(0, 0, mask.width, mask.height);

    color.imageSmoothingQuality = "high";
    for (const shift of [-width, 0, width]) {
      const x = centre - w / 2 + shift;
      if (x > width || x + w < 0) continue;
      color.drawImage(image, x, y, w, h);
      orm.drawImage(mask, x, y, w, h);
    }
  }
}

export function bodyTextures(canvases: { color: HTMLCanvasElement; orm: HTMLCanvasElement }, anisotropy: number): BodyTextures {
  const color = new THREE.CanvasTexture(canvases.color);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = THREE.RepeatWrapping;
  color.anisotropy = anisotropy;
  const orm = new THREE.CanvasTexture(canvases.orm);
  orm.colorSpace = THREE.NoColorSpace;
  orm.wrapS = THREE.RepeatWrapping;
  orm.anisotropy = anisotropy;
  return { color, orm };
}

import * as THREE from "three";

/**
 * Convert a greyscale height canvas (R channel) to a tangent-space normal map. The
 * x axis wraps when `wrapX` is set, for textures that go round the can.
 */
export function heightToNormal(source: HTMLCanvasElement, strength: number, wrapX = false, target?: HTMLCanvasElement): THREE.CanvasTexture {
  const { width, height } = source;
  const src = source.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const out = target ?? document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  writeNormals(src, image.data, width, height, strength, wrapX);
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(out);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  if (wrapX) texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function writeNormals(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, strength: number, wrapX: boolean) {
  const h = (x: number, y: number) => {
    if (wrapX) x = (x + width) % width;
    else x = Math.min(width - 1, Math.max(0, x));
    y = Math.min(height - 1, Math.max(0, y));
    return src[(y * width + x) * 4] / 255;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1)) * strength;
      // Canvas y runs down while texture v runs up, so flip the y gradient.
      const dy = -(h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * width + x) * 4;
      dst[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      dst[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      dst[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      dst[i + 3] = 255;
    }
  }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = url;
  });
}

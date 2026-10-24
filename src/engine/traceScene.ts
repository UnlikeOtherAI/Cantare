// A transferable snapshot of the can for the path-tracing worker: geometry arrays,
// world transforms, physical-material parameters and textures as ImageBitmaps.

import * as THREE from "three";

const MAPS = ["map", "roughnessMap", "metalnessMap", "normalMap", "alphaMap", "clearcoatNormalMap"] as const;
type MapName = (typeof MAPS)[number];

const NUMBERS = [
  "metalness",
  "roughness",
  "clearcoat",
  "clearcoatRoughness",
  "sheen",
  "sheenRoughness",
  "transmission",
  "ior",
  "thickness",
  "opacity",
  "alphaTest",
  "anisotropy",
  "specularIntensity",
  "envMapIntensity"
] as const;

export interface TextureSnapshot {
  id: string;
  bitmap: ImageBitmap;
  colorSpace: string;
  wrapS: number;
  wrapT: number;
}

export interface MeshSnapshot {
  attributes: Record<string, { array: Float32Array; itemSize: number }>;
  index: Uint32Array | Uint16Array | null;
  matrix: number[];
  material: {
    color: number;
    sheenColor: number;
    numbers: Partial<Record<(typeof NUMBERS)[number], number>>;
    transparent: boolean;
    side: number;
    normalScale: [number, number];
    maps: Partial<Record<MapName, string>>;
  };
}

export interface SceneSnapshot {
  meshes: MeshSnapshot[];
  textures: TextureSnapshot[];
}

/** Snapshot every visible mesh under `root` (world space), skipping `exclude`d materials. */
export async function snapshotScene(root: THREE.Object3D, exclude: Set<THREE.Material>): Promise<{ snapshot: SceneSnapshot; transfer: Transferable[] }> {
  root.updateMatrixWorld(true);
  const meshes: MeshSnapshot[] = [];
  const textures = new Map<string, Promise<TextureSnapshot>>();
  const transfer: Transferable[] = [];

  const texture = (t: THREE.Texture) => {
    if (!textures.has(t.uuid)) {
      const source = t.image as ImageBitmapSource;
      // Bitmaps cannot be flipped on upload, so flip them now.
      textures.set(
        t.uuid,
        createImageBitmap(source, { imageOrientation: t.flipY ? "flipY" : "from-image", premultiplyAlpha: "none", colorSpaceConversion: "none" }).then((bitmap) => ({
          id: t.uuid,
          bitmap,
          colorSpace: t.colorSpace,
          wrapS: t.wrapS,
          wrapT: t.wrapT
        }))
      );
    }
    return t.uuid;
  };

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    if (Array.isArray(material) || exclude.has(material)) return;
    const geometry = mesh.geometry;
    const attributes: MeshSnapshot["attributes"] = {};
    for (const name of ["position", "normal", "uv"]) {
      const attribute = geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!attribute) continue;
      const array = new Float32Array(attribute.array as ArrayLike<number>);
      attributes[name] = { array, itemSize: attribute.itemSize };
      transfer.push(array.buffer);
    }
    const index = geometry.index ? (geometry.index.array instanceof Uint32Array ? new Uint32Array(geometry.index.array) : new Uint16Array(geometry.index.array as ArrayLike<number>)) : null;
    if (index) transfer.push(index.buffer);
    const maps: MeshSnapshot["material"]["maps"] = {};
    for (const name of MAPS) {
      const map = (material as unknown as Record<MapName, THREE.Texture | null>)[name];
      if (map?.image) maps[name] = texture(map);
    }
    const numbers: MeshSnapshot["material"]["numbers"] = {};
    for (const key of NUMBERS) {
      const value = (material as unknown as Record<string, unknown>)[key];
      if (typeof value === "number") numbers[key] = value;
    }
    meshes.push({
      attributes,
      index,
      matrix: mesh.matrixWorld.toArray(),
      material: {
        color: material.color?.getHex(THREE.LinearSRGBColorSpace) ?? 0xffffff,
        sheenColor: material.sheenColor?.getHex(THREE.LinearSRGBColorSpace) ?? 0,
        numbers,
        transparent: material.transparent,
        side: material.side,
        normalScale: material.normalScale ? [material.normalScale.x, material.normalScale.y] : [1, 1],
        maps
      }
    });
  });

  const resolved = await Promise.all(textures.values());
  for (const t of resolved) transfer.push(t.bitmap);
  return { snapshot: { meshes, textures: resolved }, transfer };
}

/** Rebuild a snapshot as a group of meshes (in the worker). */
export function restoreScene(snapshot: SceneSnapshot): { group: THREE.Group; dispose(): void } {
  const textures = new Map<string, THREE.Texture>();
  for (const t of snapshot.textures) {
    const texture = new THREE.Texture(t.bitmap as unknown as HTMLImageElement);
    texture.flipY = false;
    texture.colorSpace = t.colorSpace as THREE.ColorSpace;
    texture.wrapS = t.wrapS as THREE.Wrapping;
    texture.wrapT = t.wrapT as THREE.Wrapping;
    texture.needsUpdate = true;
    textures.set(t.id, texture);
  }
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [...textures.values()];
  for (const m of snapshot.meshes) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(m.attributes)) geometry.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize));
    if (m.index) geometry.setIndex(new THREE.BufferAttribute(m.index, 1));
    const material = new THREE.MeshPhysicalMaterial();
    material.color.setHex(m.material.color, THREE.LinearSRGBColorSpace);
    material.sheenColor.setHex(m.material.sheenColor, THREE.LinearSRGBColorSpace);
    Object.assign(material, m.material.numbers);
    material.transparent = m.material.transparent;
    material.side = m.material.side as THREE.Side;
    material.normalScale.set(...m.material.normalScale);
    for (const [name, id] of Object.entries(m.material.maps)) (material as unknown as Record<string, THREE.Texture | undefined>)[name] = textures.get(id!);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.fromArray(m.matrix);
    group.add(mesh);
    disposables.push(geometry, material);
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) };
}

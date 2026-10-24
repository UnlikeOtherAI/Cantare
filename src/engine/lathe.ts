import * as THREE from "three";
import { arcLengths, type ProfilePoint } from "./profile";

export interface LatheOptions {
  segments: number;
  /**
   * `arc`: u wraps the circumference, v is arc length along the profile divided by `vLength`.
   * `planar`: top-down projection, u/v in [0, 1] across a disc of radius `planarRadius`.
   */
  uv: { mode: "arc"; vLength: number } | { mode: "planar"; planarRadius: number };
  /** Push the surface out along its normal, in mm (droplet and haze shells). */
  offset?: number;
  thetaStart?: number;
  thetaLength?: number;
}

/**
 * Revolve a profile around the Y axis. Profile r/z map to radius/height; u = 0 faces +Z
 * and grows towards +X, so artwork reads left to right from the front.
 */
export function latheGeometry(profile: ProfilePoint[], options: LatheOptions): THREE.BufferGeometry {
  const { segments } = options;
  const thetaStart = options.thetaStart ?? 0;
  const thetaLength = options.thetaLength ?? Math.PI * 2;
  const offset = options.offset ?? 0;
  const lengths = arcLengths(profile);
  const n = profile.length;

  const normals2: [number, number][] = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)];
    const b = profile[Math.min(n - 1, i + 1)];
    const dr = b.r - a.r;
    const dz = b.z - a.z;
    const len = Math.hypot(dr, dz) || 1;
    return [dz / len, -dr / len];
  });

  const positions = new Float32Array(n * (segments + 1) * 3);
  const normals = new Float32Array(n * (segments + 1) * 3);
  const uvs = new Float32Array(n * (segments + 1) * 2);

  for (let j = 0; j <= segments; j++) {
    const u = j / segments;
    const theta = thetaStart + u * thetaLength;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const [nr, nz] = normals2[i];
      const r = Math.max(0, profile[i].r + nr * offset);
      const z = profile[i].z + nz * offset;
      positions.set([r * sin, z, r * cos], k * 3);
      normals.set([nr * sin, nz, nr * cos], k * 3);
      if (options.uv.mode === "arc") {
        uvs.set([u, lengths[i] / options.uv.vLength], k * 2);
      } else {
        const pr = options.uv.planarRadius;
        uvs.set([0.5 + (r * sin) / (2 * pr), 0.5 - (r * cos) / (2 * pr)], k * 2);
      }
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = j * n + i + 1;
      const c = (j + 1) * n + i;
      const d = (j + 1) * n + i + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

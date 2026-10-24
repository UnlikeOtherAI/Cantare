// Radius-versus-height profiles for a can, in millimetres, z = 0 at the standing ring.
// The body is built from its published envelope (diameter, seamed height, neck height,
// standing ring) and the end from its CDL dimensions; curve shapes between those
// landmarks are visual approximations (see docs/can-reference.md, sections 5 and 6).

import { ENDS, type CanFormat, type EndSpec } from "./formats";

export interface ProfilePoint {
  r: number;
  z: number;
}

export interface CanProfiles {
  /** Outside wall: standing ring contact up to the neck under the seam. */
  body: ProfilePoint[];
  /** Underside: dome centre out to the standing ring contact. */
  dome: ProfilePoint[];
  /** Seam, chuck wall, countersink and centre panel, outside in. */
  lid: ProfilePoint[];
  landmarks: CanLandmarks;
}

export interface CanLandmarks {
  radius: number;
  height: number;
  heelTop: number;
  shoulderStart: number;
  neckTop: number;
  neckRadius: number;
  rimRadius: number;
  panelZ: number;
  panelRadius: number;
  end: EndSpec;
}

type Vec = [number, number];

function bezier(p0: Vec, p1: Vec, p2: Vec, p3: Vec, steps: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (1 - t) ** 3;
    const b = 3 * (1 - t) ** 2 * t;
    const c = 3 * (1 - t) * t * t;
    const d = t ** 3;
    out.push({ r: a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], z: a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1] });
  }
  return out;
}

function line(p0: Vec, p1: Vec, steps: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({ r: p0[0] + (p1[0] - p0[0]) * t, z: p0[1] + (p1[1] - p0[1]) * t });
  }
  return out;
}

/** Centripetal Catmull-Rom through `points`, resampled at roughly `spacing` mm. */
function smoothThrough(points: Vec[], spacing: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  const p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const d = (a: Vec, b: Vec) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0;
    const t1 = t0 + d(p0, p1);
    const t2 = t1 + d(p1, p2);
    const t3 = t2 + d(p2, p3);
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(2, Math.ceil(segLen / spacing));
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      const lerp = (a: Vec, b: Vec, ta: number, tb: number): Vec => {
        if (tb - ta < 1e-9) return a;
        const k = (t - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      };
      const a1 = lerp(p0, p1, t0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, t0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      const c = lerp(b1, b2, t1, t2);
      out.push({ r: c[0], z: c[1] });
    }
  }
  return out;
}

function join(...parts: ProfilePoint[][]): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (const part of parts) {
    for (const point of part) {
      const last = out[out.length - 1];
      if (last && Math.hypot(last.r - point.r, last.z - point.z) < 1e-3) continue;
      out.push(point);
    }
  }
  return out;
}

export function buildProfiles(format: CanFormat): CanProfiles {
  const end = ENDS[format.end];
  const R = format.bodyDiameter / 2;
  const H = format.height;
  const standR = format.standDiameter / 2;
  const rimR = end.rimDiameter / 2;
  const neckR = end.plugDiameter / 2 + 0.25;
  const seamBottom = H - end.seamHeight;

  // Heel: from the contact ring, sweeping out to the barrel. Height scales with the
  // radial step so slim cans get a shorter heel than standard ones.
  const heelTop = Math.min(0.16 * format.bodyDiameter, 2.2 + (R - standR) * 0.95);
  const heel = bezier([standR, 0], [standR + 0.55 * (R - standR), heelTop * 0.3], [R, heelTop * 0.5], [R, heelTop], 28);

  // Barrel, with the slight lower-body bulge the drawings allow (66.6 vs 66.3 mm).
  const shoulderStart = H - format.neckHeight;
  const bulgeZ = heelTop + 3.5;
  const barrel = line([R, heelTop], [R, shoulderStart], Math.max(12, Math.ceil((shoulderStart - heelTop) / 2.5))).map((p) => ({
    r: p.r + 0.15 * Math.exp(-(((p.z - bulgeZ) / 3) ** 2)),
    z: p.z
  }));

  // Shoulder: an S-curve with vertical tangents at both ends, plus the faint die-necking
  // steps that show up as banding in reflections.
  const neckStraight = Math.min(1.5, (seamBottom - shoulderStart) * 0.15);
  const shoulderTop = seamBottom - neckStraight;
  const shoulderLen = shoulderTop - shoulderStart;
  const shoulder = bezier([R, shoulderStart], [R, shoulderStart + 0.42 * shoulderLen], [neckR, shoulderTop - 0.45 * shoulderLen], [neckR, shoulderTop], 48).map(
    (p, i, all) => {
      const t = i / (all.length - 1);
      return { r: p.r + 0.025 * Math.sin(t * Math.PI * 7) * Math.sin(t * Math.PI), z: p.z };
    }
  );
  const neck = line([neckR, shoulderTop], [neckR, seamBottom + 0.4], 3);

  const body = join(heel, barrel, shoulder, neck);

  // Underside: standing-ring inner wall up into the dome.
  const domeDepth = 0.168 * format.bodyDiameter;
  const domeEdgeR = standR - 2.2;
  const domeEdgeZ = 3.2;
  const domeCap: ProfilePoint[] = [];
  for (let i = 0; i <= 24; i++) {
    const r = (domeEdgeR * i) / 24;
    domeCap.push({ r, z: domeDepth - (domeDepth - domeEdgeZ) * (r / domeEdgeR) ** 2 });
  }
  const ringInside = smoothThrough(
    [
      [domeEdgeR, domeEdgeZ],
      [standR - 1.7, 2.0],
      [standR - 0.9, 0.55],
      [standR - 0.3, 0.06],
      [standR, 0]
    ],
    0.25
  );
  const dome = join(domeCap, ringInside);

  // Lid: seam crown, chuck wall, countersink trough and centre panel.
  const cs = end.countersinkDepth;
  const panelZ = H - cs + end.panelRise;
  const panelRadius = rimR - 3.6;
  const lidOuter = smoothThrough(
    [
      [neckR - 0.05, seamBottom - 0.1],
      [neckR + 0.35, seamBottom + 0.02],
      [rimR - 0.3, seamBottom + 0.22],
      [rimR, seamBottom + 0.75],
      [rimR - 0.04, H - 0.75],
      [rimR - 0.35, H - 0.12],
      [rimR - 0.9, H],
      [rimR - 1.4, H - 0.22],
      [rimR - 1.62, H - 1.0],
      [rimR - 1.85, H - 2.6],
      [rimR - 2.2, H - cs + 0.7],
      [rimR - 2.55, H - cs],
      [rimR - 2.95, H - cs + 0.45],
      [rimR - 3.15, H - cs + 1.4],
      [rimR - 3.35, panelZ - 0.08],
      [panelRadius, panelZ]
    ],
    0.12
  );
  const panel = line([panelRadius, panelZ], [0, panelZ + 0.15], 24);
  const lid = join(lidOuter, panel);

  return {
    body,
    dome,
    lid,
    landmarks: { radius: R, height: H, heelTop, shoulderStart, neckTop: seamBottom, neckRadius: neckR, rimRadius: rimR, panelZ, panelRadius, end }
  };
}

/** Cumulative arc length along a profile. */
export function arcLengths(points: ProfilePoint[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + Math.hypot(points[i].r - points[i - 1].r, points[i].z - points[i - 1].z));
  }
  return out;
}

/** Arc length on `points` at height `z` (first crossing from the bottom). */
export function arcAtHeight(points: ProfilePoint[], lengths: number[], z: number): number {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if ((a.z <= z && b.z >= z) || (a.z >= z && b.z <= z)) {
      const t = b.z === a.z ? 0 : (z - a.z) / (b.z - a.z);
      return lengths[i - 1] + (lengths[i] - lengths[i - 1]) * t;
    }
  }
  return z <= points[0].z ? 0 : lengths[lengths.length - 1];
}

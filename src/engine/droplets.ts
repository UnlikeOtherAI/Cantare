// Water on the can: droplets, runs and condensation haze, simulated in the body's
// unwrapped surface (x = mm around the circumference, y = mm of arc length up the
// profile) and painted into textures for the droplet and haze shells.

import * as THREE from "three";

export interface Drop {
  x: number;
  y: number;
  r: number;
}

interface Trail {
  points: [number, number][];
  width: number;
}

const CELL = 6;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DropletField {
  readonly height = document.createElement("canvas");
  readonly coverage = document.createElement("canvas");
  readonly haze = document.createElement("canvas");
  readonly heightTexture: THREE.CanvasTexture;
  readonly coverageTexture: THREE.CanvasTexture;
  readonly hazeTexture: THREE.CanvasTexture;

  private drops: Drop[] = [];
  private trails: Trail[] = [];
  private wipes: Trail[] = [];
  private grid = new Map<string, Drop[]>();
  private hazeNoise: ImageData | null = null;
  private random = mulberry32(1);
  private dirty = true;
  /** Radius (mm) above which a drop slides down the wall. */
  private runRadius = 2.4;

  constructor(
    private circumference: number,
    private arc: number,
    private bounds: { low: number; high: number },
    private resolution: number
  ) {
    this.heightTexture = this.texture(this.height);
    this.coverageTexture = this.texture(this.coverage);
    this.hazeTexture = this.texture(this.haze);
    this.resize();
  }

  get count() {
    return this.drops.length;
  }
  private texture(canvas: HTMLCanvasElement) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }

  private resize() {
    const w = this.resolution;
    const h = Math.round((w * this.arc) / this.circumference);
    this.height.width = this.coverage.width = w;
    this.height.height = this.coverage.height = h;
    this.haze.width = Math.round(w / 2);
    this.haze.height = Math.round(h / 2);
    this.hazeNoise = null;
  }

  /** Keep the water when the can changes size, rescaling it onto the new surface. */
  reshape(circumference: number, arc: number, bounds: { low: number; high: number }) {
    const sx = circumference / this.circumference;
    const sy = arc / this.arc;
    for (const d of this.drops) {
      d.x *= sx;
      d.y *= sy;
    }
    for (const t of [...this.trails, ...this.wipes]) t.points = t.points.map(([x, y]) => [x * sx, y * sy]);
    this.circumference = circumference;
    this.arc = arc;
    this.bounds = bounds;
    this.resize();
    this.rebuildGrid();
    this.dirty = true;
  }

  clear() {
    this.drops = [];
    this.trails = [];
    this.wipes = [];
    this.grid.clear();
    this.dirty = true;
  }

  /** Replace the water with a natural scatter. */
  scatter(density: number, size: number, seed: number) {
    this.clear();
    if (density <= 0) return;
    this.random = mulberry32(seed * 9973 + 17);
    const area = this.circumference * (this.bounds.high - this.bounds.low);
    const target = area * density * 0.55;
    const maxR = 0.45 + size * 2.4;
    let covered = 0;
    let guard = 0;
    while (covered < target && guard++ < 40000) {
      const r = 0.1 + (maxR - 0.1) * this.random() ** 3.2;
      const drop = { x: this.random() * this.circumference, y: this.bounds.low + this.random() * (this.bounds.high - this.bounds.low), r };
      covered += Math.PI * r * r;
      this.add(drop);
    }
    this.dirty = true;
  }

  /** 0..1: how readily heavy drops run. */
  setRuns(runs: number) {
    this.runRadius = 3.0 - runs * 1.9;
  }

  /** Spray a burst of fine droplets around a point. */
  spray(x: number, y: number, radius: number, size: number, flow = 0.6) {
    const count = Math.round((4 + radius * 1.6) * (0.3 + flow * 1.2));
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const dist = radius * Math.sqrt(-2 * Math.log(1 - this.random() * 0.98)) * 0.45;
      const r = 0.08 + (0.25 + size * 0.9) * this.random() ** 2.4;
      this.add({ x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, r });
    }
    this.dirty = true;
  }

  /** Paint drops where the brush passes: fewer, fuller drops than the spray. */
  brush(x: number, y: number, radius: number, size: number, flow = 0.6) {
    const count = Math.max(1, Math.round(radius * 0.35 * (0.3 + flow)));
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const dist = radius * Math.sqrt(this.random());
      const r = 0.2 + (0.4 + size * 1.6) * this.random() ** 1.8;
      this.add({ x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, r });
    }
    this.dirty = true;
  }

  /** Drag water along with a finger: drops in the brush move and merge. */
  spread(x: number, y: number, dx: number, dy: number, radius: number) {
    const moved: Drop[] = [];
    this.drops = this.drops.filter((d) => {
      const dist = Math.hypot(this.wrapDelta(d.x - x), d.y - y);
      if (dist > radius) return true;
      const k = 1 - dist / radius;
      d.x += dx * k;
      d.y += dy * k;
      moved.push(d);
      return false;
    });
    this.rebuildGrid();
    if (moved.length) this.trails.push({ points: [[x - dx, y - dy], [x, y]], width: Math.min(radius * 0.5, 3) });
    for (const d of moved) this.add(d);
    this.dirty = true;
  }

  /** Wipe water and condensation off under the brush. */
  wipe(x: number, y: number, radius: number) {
    this.drops = this.drops.filter((d) => Math.hypot(this.wrapDelta(d.x - x), d.y - y) > radius);
    this.rebuildGrid();
    const last = this.wipes[this.wipes.length - 1];
    if (last && Math.hypot(last.points[last.points.length - 1][0] - x, last.points[last.points.length - 1][1] - y) < radius) {
      last.points.push([x, y]);
    } else {
      this.wipes.push({ points: [[x, y]], width: radius * 2 });
    }
    this.dirty = true;
  }

  endStroke() {
    this.wipes.push({ points: [], width: 0 });
  }

  private wrapDelta(dx: number) {
    const c = this.circumference;
    return dx - Math.round(dx / c) * c;
  }

  private key(x: number, y: number) {
    const c = this.circumference;
    const wx = ((x % c) + c) % c;
    return `${Math.floor(wx / CELL)},${Math.floor(y / CELL)}`;
  }

  private rebuildGrid() {
    this.grid.clear();
    for (const d of this.drops) this.insert(d);
  }

  private insert(d: Drop) {
    const k = this.key(d.x, d.y);
    const list = this.grid.get(k);
    if (list) list.push(d);
    else this.grid.set(k, [d]);
  }

  private remove(d: Drop) {
    const list = this.grid.get(this.key(d.x, d.y));
    const j = list ? list.indexOf(d) : -1;
    if (j >= 0) list!.splice(j, 1);
    const i = this.drops.indexOf(d);
    if (i >= 0) this.drops.splice(i, 1);
  }

  private neighbour(d: Drop): Drop | null {
    const reach = Math.ceil((d.r + 3) / CELL);
    for (let gx = -reach; gx <= reach; gx++) {
      for (let gy = -reach; gy <= reach; gy++) {
        const list = this.grid.get(this.key(d.x + gx * CELL, d.y + gy * CELL));
        if (!list) continue;
        for (const o of list) {
          if (Math.hypot(this.wrapDelta(o.x - d.x), o.y - d.y) < (d.r + o.r) * 0.82) return o;
        }
      }
    }
    return null;
  }

  /** Add a drop, merging with anything it touches and letting heavy drops run. */
  private add(drop: Drop) {
    const c = this.circumference;
    drop.x = ((drop.x % c) + c) % c;
    if (drop.y < this.bounds.low || drop.y > this.bounds.high) return;
    let other = this.neighbour(drop);
    while (other) {
      this.remove(other);
      const v1 = drop.r ** 3;
      const v2 = other.r ** 3;
      const ox = drop.x + this.wrapDelta(other.x - drop.x);
      drop.x = (drop.x * v1 + ox * v2) / (v1 + v2);
      drop.y = (drop.y * v1 + other.y * v2) / (v1 + v2);
      drop.r = Math.cbrt(v1 + v2);
      other = this.neighbour(drop);
    }
    if (drop.r > this.runRadius) {
      this.run(drop);
      return;
    }
    this.drops.push(drop);
    this.insert(drop);
  }

  /** A heavy drop slides down, leaving a wet trail and a bead of small drops. */
  private run(drop: Drop) {
    const trail: Trail = { points: [[drop.x, drop.y]], width: drop.r * 0.9 };
    let { x, y } = drop;
    let volume = drop.r ** 3;
    let step = 0;
    while (y > this.bounds.low + 1 && step++ < 400) {
      y -= 0.8;
      x += (this.random() - 0.5) * 0.35;
      trail.points.push([x, y]);
      // Pick up anything in the path.
      const hit = this.neighbour({ x, y, r: Math.cbrt(volume) });
      if (hit) {
        this.remove(hit);
        volume += hit.r ** 3;
      }
      // Leave beads behind.
      if (this.random() < 0.18) {
        const r = 0.12 + this.random() * 0.22;
        volume -= r ** 3;
        const bead = { x: x + (this.random() - 0.5) * trail.width, y, r };
        this.drops.push(bead);
        this.insert(bead);
      }
      volume -= 0.012 * Math.cbrt(volume);
      if (Math.cbrt(volume) < this.runRadius * 0.82) break;
    }
    this.trails.push(trail);
    const r = Math.cbrt(Math.max(volume, 0.05));
    const end = { x, y: Math.max(y, this.bounds.low + r), r: Math.min(r, this.runRadius * 0.98) };
    this.drops.push(end);
    this.insert(end);
  }

  /** Repaint textures if anything changed. Returns true when it did. */
  render(): boolean {
    if (!this.dirty) return false;
    this.dirty = false;
    const w = this.height.width;
    const h = this.height.height;
    const px = w / this.circumference;
    const toY = (y: number) => (1 - y / this.arc) * h;

    const hc = this.height.getContext("2d")!;
    const cc = this.coverage.getContext("2d")!;
    hc.globalCompositeOperation = "source-over";
    hc.fillStyle = "#000";
    hc.fillRect(0, 0, w, h);
    cc.globalCompositeOperation = "source-over";
    cc.fillStyle = "#000";
    cc.fillRect(0, 0, w, h);

    // Wet trails: a thin film of water.
    for (const ctx of [hc, cc]) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = ctx === hc ? "rgb(46,46,46)" : "rgb(0,150,150)";
      for (const trail of this.trails) {
        for (const shift of [-w, 0, w]) {
          ctx.lineWidth = trail.width * px;
          ctx.beginPath();
          trail.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * px + shift, toY(y)) : ctx.moveTo(x * px + shift, toY(y))));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    hc.globalCompositeOperation = "lighten";
    for (const d of this.drops) {
      const rx = d.r * px;
      const ry = rx * 1.06;
      const peak = Math.min(1, 0.35 + d.r * 0.32);
      for (const shift of [-w, 0, w]) {
        const cx = d.x * px + shift;
        if (cx + rx < 0 || cx - rx > w) continue;
        // Gravity: drops sag, so the thickest part sits below the centre.
        const cy = toY(d.y);
        const g = hc.createRadialGradient(cx, cy + ry * 0.12, 0, cx, cy, ry);
        for (const t of [0, 0.25, 0.45, 0.62, 0.76, 0.87, 0.94, 1]) {
          const v = Math.round(255 * peak * Math.pow(Math.max(0, 1 - t * t), 0.55));
          g.addColorStop(t, `rgb(${v},${v},${v})`);
        }
        hc.fillStyle = g;
        hc.beginPath();
        hc.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        hc.fill();
        // Coverage: G = alpha, B = how close to the rim (drops refract a dark ring there).
        const edge = cc.createRadialGradient(cx, cy - ry * 0.08, 0, cx, cy, ry * 0.97);
        edge.addColorStop(0, "rgb(0,255,0)");
        edge.addColorStop(0.55, "rgb(0,255,30)");
        edge.addColorStop(0.82, "rgb(0,255,170)");
        edge.addColorStop(1, "rgb(0,255,255)");
        cc.globalCompositeOperation = "source-over";
        cc.fillStyle = edge;
        cc.beginPath();
        cc.ellipse(cx, cy, rx * 0.97, ry * 0.97, 0, 0, Math.PI * 2);
        cc.fill();
        // R = caustic: light focused through the drop onto the can, low in the bead.
        if (rx > 2) {
          const ky = cy + ry * 0.48;
          const caustic = cc.createRadialGradient(cx, ky, 0, cx, ky, rx * 0.42);
          caustic.addColorStop(0, "rgba(255,0,0,0.9)");
          caustic.addColorStop(1, "rgba(255,0,0,0)");
          cc.globalCompositeOperation = "lighter";
          cc.fillStyle = caustic;
          cc.beginPath();
          cc.ellipse(cx, ky, rx * 0.42, ry * 0.26, 0, 0, Math.PI * 2);
          cc.fill();
        }
      }
    }

    this.paintHaze();
    this.heightTexture.needsUpdate = true;
    this.coverageTexture.needsUpdate = true;
    this.hazeTexture.needsUpdate = true;
    return true;
  }

  private paintHaze() {
    const w = this.haze.width;
    const h = this.haze.height;
    const ctx = this.haze.getContext("2d")!;
    if (!this.hazeNoise) {
      const rand = mulberry32(4242);
      const data = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        // Fine micro-droplets: mostly dense fog with brighter specks.
        const r = rand();
        const v = 70 + r * r * 120 + (rand() < 0.06 ? 65 : 0);
        data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = Math.min(255, v);
        data.data[i * 4 + 3] = 255;
      }
      this.hazeNoise = data;
    }
    ctx.putImageData(this.hazeNoise, 0, 0);
    const px = w / this.circumference;
    const toY = (y: number) => (1 - y / this.arc) * h;
    // Drops gather the fog around them, and trails and wipes clear it.
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const shift of [-w, 0, w]) {
      for (const d of this.drops) {
        ctx.beginPath();
        ctx.arc(d.x * px + shift, toY(d.y), d.r * px * 1.18 + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const t of [...this.trails, ...this.wipes]) {
        if (!t.points.length) continue;
        ctx.lineWidth = t.width * px * (this.wipes.includes(t) ? 1 : 1.4);
        ctx.beginPath();
        t.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * px + shift, toY(y)) : ctx.moveTo(x * px + shift, toY(y))));
        if (t.points.length === 1) ctx.lineTo(t.points[0][0] * px + shift + 0.1, toY(t.points[0][1]));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

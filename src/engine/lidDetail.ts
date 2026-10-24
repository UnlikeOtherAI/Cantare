// Pull tab, rivet and the stamped lid features (score line, tear panel, finger recess).
// Tab size follows the Stolle conventional example (≈25 × 15.75 mm); the outline and
// stamped features are visual approximations.

import * as THREE from "three";
import { heightToNormal } from "./textures";

export function tabGeometry(scale: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-5, -6.2);
  shape.quadraticCurveTo(0, -8.1, 5, -6.2);
  shape.lineTo(7.2, -1.5);
  shape.bezierCurveTo(7.87, 1, 7.87, 6, 7.87, 10.2);
  shape.absarc(0, 10.2, 7.87, 0, Math.PI, false);
  shape.bezierCurveTo(-7.87, 6, -7.87, 1, -7.2, -1.5);
  shape.lineTo(-5, -6.2);

  const finger = new THREE.Path();
  finger.absellipse(0, 11.0, 5.4, 3.7, 0, Math.PI * 2, true, 0);
  shape.holes.push(finger);

  // U-slot that frees the riveted tongue.
  const slot = new THREE.Path();
  slot.absarc(0, 0.4, 4.3, Math.PI * 0.12, Math.PI * 0.88, false);
  slot.absarc(0, 0.4, 3.55, Math.PI * 0.88, Math.PI * 0.12, true);
  slot.closePath();
  shape.holes.push(slot);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.22,
    bevelSegments: 4,
    curveSegments: 40
  });
  geometry.rotateX(-Math.PI / 2);
  // Nose sits slightly lower than the finger end lifts.
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < -11) pos.setY(i, pos.getY(i) + (-11 - z) * 0.03);
  }
  geometry.scale(scale, scale, scale);
  geometry.computeVertexNormals();
  return geometry;
}

export function rivetGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.0001, 0.62),
    new THREE.Vector2(0.9, 0.6),
    new THREE.Vector2(1.45, 0.52),
    new THREE.Vector2(1.75, 0.32),
    new THREE.Vector2(1.85, 0.08),
    new THREE.Vector2(1.9, 0)
  ];
  return new THREE.LatheGeometry(points, 48);
}

/**
 * Height map for the lid panel in the lid's planar UV space (top-down, front at the
 * bottom of the canvas), converted to a normal map.
 */
export function lidNormalMap(planarRadius: number, panelRadius: number, size = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const px = size / (2 * planarRadius);
  const toX = (x: number) => size / 2 + x * px;
  const toY = (z: number) => size / 2 + z * px;

  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Tear panel outline: a rounded trapezoid opening towards the front rim.
  const opening = new Path2D();
  opening.moveTo(toX(-5.2), toY(4.6));
  opening.bezierCurveTo(toX(-9.5), toY(6), toX(-11.2), toY(13), toX(-9.6), toY(17.6));
  opening.bezierCurveTo(toX(-7.5), toY(21.4), toX(7.5), toY(21.4), toX(9.6), toY(17.6));
  opening.bezierCurveTo(toX(11.2), toY(13), toX(9.5), toY(6), toX(5.2), toY(4.6));

  // Raised tear panel with a soft inner bead.
  ctx.save();
  ctx.filter = `blur(${0.5 * px}px)`;
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fill(opening);
  ctx.restore();

  // Score line: a fine groove, broken at the hinge by the rivet.
  ctx.save();
  ctx.strokeStyle = "rgb(70,70,70)";
  ctx.lineWidth = 0.32 * px;
  ctx.setLineDash([]);
  ctx.stroke(opening);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgb(150,150,150)";
  ctx.lineWidth = 0.6 * px;
  ctx.beginPath();
  ctx.moveTo(toX(-5.6), toY(4.4));
  ctx.lineTo(toX(5.6), toY(4.4));
  ctx.stroke();
  ctx.restore();

  // Anti-fracture score just inside the main score.
  ctx.save();
  ctx.translate(toX(0), toY(12.8));
  ctx.scale(0.86, 0.84);
  ctx.translate(-toX(0), -toY(12.8));
  ctx.strokeStyle = "rgb(112,112,112)";
  ctx.lineWidth = 0.22 * px;
  ctx.stroke(opening);
  ctx.restore();

  // Finger recess behind the rivet.
  ctx.save();
  ctx.filter = `blur(${1.2 * px}px)`;
  ctx.fillStyle = "rgb(84,84,84)";
  ctx.beginPath();
  ctx.ellipse(toX(0), toY(-12.2), 7 * px, 4.2 * px, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Panel reinforcing bead around the edge.
  ctx.save();
  ctx.filter = `blur(${0.45 * px}px)`;
  ctx.strokeStyle = "rgb(160,160,160)";
  ctx.lineWidth = 0.9 * px;
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), (panelRadius - 1.6) * px, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Rivet bubble.
  ctx.save();
  ctx.filter = `blur(${0.6 * px}px)`;
  ctx.fillStyle = "rgb(160,160,160)";
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), 3.1 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return heightToNormal(canvas, 2.2);
}

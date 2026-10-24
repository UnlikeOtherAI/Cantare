import { describe, expect, it } from "vitest";
import { placeArtwork } from "./decoration";
import { ENDS, FORMATS, getFormat } from "./formats";
import { arcAtHeight, arcLengths, buildProfiles } from "./profile";
import { DEFAULT_SETTINGS } from "./settings";

describe("formats", () => {
  it("have unique ids and plausible envelopes", () => {
    expect(new Set(FORMATS.map((f) => f.id)).size).toBe(FORMATS.length);
    for (const f of FORMATS) {
      expect(f.bodyDiameter).toBeGreaterThan(50);
      expect(f.height).toBeGreaterThan(f.bodyDiameter);
      expect(f.standDiameter).toBeLessThan(f.bodyDiameter);
      expect(ENDS[f.end].rimDiameter).toBeLessThan(f.bodyDiameter);
    }
  });

  it("falls back to the default format", () => {
    expect(getFormat("nope").id).toBe("eu-std-440");
  });
});

describe("profiles", () => {
  for (const f of FORMATS) {
    it(`${f.id} matches its published envelope`, () => {
      const { body, lid, dome, landmarks } = buildProfiles(f);
      const maxR = Math.max(...body.map((p) => p.r));
      // Barrel at the published diameter, plus at most the lower-body bulge.
      expect(maxR).toBeGreaterThanOrEqual(f.bodyDiameter / 2);
      expect(maxR).toBeLessThanOrEqual(f.bodyDiameter / 2 + 0.16);
      // Seamed height is the top of the lid seam.
      expect(Math.max(...lid.map((p) => p.z))).toBeCloseTo(f.height, 1);
      expect(body[0]).toEqual({ r: f.standDiameter / 2, z: 0 });
      expect(dome[dome.length - 1]).toEqual({ r: f.standDiameter / 2, z: 0 });
      expect(Math.max(...dome.map((p) => p.z))).toBeLessThan(landmarks.shoulderStart);
      // Body never pokes out past the seam above the shoulder.
      for (const p of body) if (p.z > landmarks.neckTop - 1) expect(p.r).toBeLessThan(landmarks.rimRadius);
    });
  }

  it("finds arc length at a height", () => {
    const { body } = buildProfiles(getFormat("eu-std-440"));
    const arcs = arcLengths(body);
    expect(arcAtHeight(body, arcs, 0)).toBe(0);
    expect(arcAtHeight(body, arcs, 80)).toBeGreaterThan(80);
  });
});

describe("artwork placement", () => {
  const format = getFormat("eu-std-440");
  const profiles = buildProfiles(format);
  const arcs = arcLengths(profiles.body);
  const place = (aspect: number, patch: Partial<typeof DEFAULT_SETTINGS.artwork> = {}) =>
    placeArtwork(format, profiles.landmarks, profiles.body, arcs, aspect, { ...DEFAULT_SETTINGS.artwork, ...patch });

  it("uses the supplier template when the artwork matches it", () => {
    const p = place(206 / 141.4);
    expect(p.fromTemplate).toBe(true);
    expect(p.height).toBeCloseTo(141.4);
    expect(p.wrap).toBeCloseTo(1, 1);
  });

  it("infers height from a full-wrap image", () => {
    const p = place(3);
    expect(p.fromTemplate).toBe(false);
    expect(p.height).toBeCloseTo((Math.PI * format.bodyDiameter) / 3, 3);
    expect(p.wrap).toBeCloseTo(1, 5);
  });

  it("turns a tall image into a front panel rather than overflowing", () => {
    const p = place(0.8);
    expect(p.wrap).toBeLessThan(1);
    expect(p.bottom + p.height).toBeLessThanOrEqual(arcs[arcs.length - 1]);
  });

  it("keeps labels on the straight barrel", () => {
    const p = place(4, { mode: "label" });
    expect(p.bottom).toBeGreaterThanOrEqual(profiles.landmarks.heelTop);
    expect(p.bottom + p.height).toBeLessThanOrEqual(profiles.landmarks.shoulderStart);
  });

  it("honours a manual height and offset within bounds", () => {
    const p = place(3, { height: 60, offset: 500 });
    expect(p.height).toBe(60);
    expect(p.bottom + p.height).toBeLessThanOrEqual(arcs[arcs.length - 1]);
  });
});

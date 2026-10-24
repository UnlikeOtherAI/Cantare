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
  const { landmarks } = profiles;
  const C = Math.PI * format.bodyDiameter;
  const place = (aspect: number, patch: Partial<typeof DEFAULT_SETTINGS.artwork> = {}) =>
    placeArtwork(format, landmarks, profiles.body, arcs, aspect, { ...DEFAULT_SETTINGS.artwork, ...patch });

  it("prints from the foot to the lip by default", () => {
    const p = place(1.5);
    expect(p.base).toBe(0);
    expect(p.top).toBeCloseTo(landmarks.neckTop - 0.2, 5);
    expect(p.bottom).toBe(0);
    expect(p.height).toBeGreaterThan(p.top - p.base);
  });

  it("stretches near-fitting printed artwork all round, and keeps proportions otherwise", () => {
    const fullHeightArc = place(1).height;
    expect(place(C / fullHeightArc * 1.05).wrap).toBe(1);
    expect(place(C / fullHeightArc * 1.05).stretched).toBe(true);
    const narrow = place(0.8);
    expect(narrow.wrap).toBeLessThan(1);
    expect(narrow.wrap).toBeCloseTo((narrow.height * 0.8) / C, 5);
  });

  it("recognises the supplier template", () => {
    expect(place(206 / 141.4).fromTemplate).toBe(true);
    expect(place(3).fromTemplate).toBe(false);
  });

  it("keeps labels on the flat barrel", () => {
    const p = place(4, { mode: "label" });
    expect(p.base).toBeGreaterThanOrEqual(landmarks.heelTop);
    expect(p.top).toBeLessThanOrEqual(landmarks.shoulderStart);
    expect(p.bottom).toBe(p.base);
  });

  it("sizes stickers from the image as a centred patch", () => {
    const p = place(1.5, { mode: "sticker" });
    expect(p.wrap).toBeCloseTo(((p.top - p.base) * 1.5) / C, 5);
    expect(p.base).toBeGreaterThan(p.range.low);
    expect(p.top).toBeLessThan(p.range.high);
  });

  it("clamps manual edges to the mode's area and keeps them apart", () => {
    const p = place(3, { mode: "label", top: 500, bottom: -20 });
    expect(p.top).toBeLessThanOrEqual(p.range.high);
    expect(p.base).toBeGreaterThanOrEqual(p.range.low);
    const q = place(3, { mode: "label", top: 50, bottom: 50 });
    expect(q.top - q.base).toBeGreaterThanOrEqual(4);
  });

  it("honours an explicit fit", () => {
    expect(place(3, { fit: "wrap" }).wrap).toBe(1);
    expect(place(0.5, { fit: "aspect", mode: "label" }).wrap).toBeLessThan(1);
  });
});

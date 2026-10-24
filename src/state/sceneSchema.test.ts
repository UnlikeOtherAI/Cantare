import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../engine/settings";
import { decodeScene, encodeScene, mergeOver, migrate, sanitizeImages, sanitizeSettings, sanitizeUi, SCHEMA_VERSION, type SceneUi } from "./sceneSchema";

const UI: SceneUi = { sceneName: "Untitled scene", exportAspect: [4, 5], prompt: "", backgroundSource: "generate" };

describe("mergeOver", () => {
  it("drops keys the defaults do not have", () => {
    const merged = mergeOver({ a: 1, nested: { b: "x" } }, { a: 2, gone: true, nested: { b: "y", extra: 1 } });
    expect(merged).toEqual({ a: 2, nested: { b: "y" } });
  });

  it("drops values whose type does not match the default", () => {
    expect(mergeOver({ n: 1, s: "a", b: true }, { n: "2", s: 3, b: "yes" })).toEqual({ n: 1, s: "a", b: true });
    expect(mergeOver({ n: 1 }, { n: Number.NaN })).toEqual({ n: 1 });
    expect(mergeOver({ n: 1 }, { n: null })).toEqual({ n: 1 });
  });

  it("accepts null or a primitive where the default is null", () => {
    expect(mergeOver({ v: null as number | null }, { v: 0.5 })).toEqual({ v: 0.5 });
    expect(mergeOver({ v: null as string | null }, { v: "name" })).toEqual({ v: "name" });
    expect(mergeOver({ v: null as number[] | null }, { v: [1, 2, 3] })).toEqual({ v: [1, 2, 3] });
    expect(mergeOver({ v: null }, { v: { nested: 1 } })).toEqual({ v: null });
    expect(mergeOver({ v: null }, { v: ["a"] })).toEqual({ v: null });
  });

  it("defaults sections that are missing or not objects", () => {
    const defaults = { a: { x: 1 }, b: { y: 2 } };
    expect(mergeOver(defaults, { a: "nope" })).toEqual(defaults);
    expect(mergeOver(defaults, [1, 2])).toEqual(defaults);
    expect(mergeOver(defaults, null)).toEqual(defaults);
  });

  it("keeps tuples only with the same length and element types", () => {
    expect(mergeOver({ t: [4, 5] }, { t: [16, 9] })).toEqual({ t: [16, 9] });
    expect(mergeOver({ t: [4, 5] }, { t: [16] })).toEqual({ t: [4, 5] });
    expect(mergeOver({ t: [4, 5] }, { t: ["16", 9] })).toEqual({ t: [4, 5] });
  });

  it("requires a hex colour where the default is one", () => {
    expect(mergeOver({ c: "#c8102e" }, { c: "#00FF00" })).toEqual({ c: "#00FF00" });
    expect(mergeOver({ c: "#c8102e" }, { c: "red; background: url(x)" })).toEqual({ c: "#c8102e" });
  });

  it("ignores prototype keys", () => {
    const merged = mergeOver({ a: 1 }, JSON.parse('{"__proto__": {"polluted": true}, "a": 2}')) as Record<string, unknown>;
    expect(merged).toEqual({ a: 2 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("sanitizeSettings", () => {
  it("returns the defaults for garbage", () => {
    for (const value of [undefined, null, 42, "x", [], { body: 7 }]) expect(sanitizeSettings(value)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values section by section and defaults the rest", () => {
    const stored = {
      formatId: "us-std-12oz",
      body: { preset: "gold", color: "#123456", finish: "matte", sparkle: 3 },
      lighting: { azimuth: 25, environment: "golden", unknownLight: 1 },
      tilt: { pitch: 12 },
      oldField: "dropped"
    };
    const settings = sanitizeSettings(stored);
    expect(settings.formatId).toBe("us-std-12oz");
    expect(settings.body).toEqual({ ...DEFAULT_SETTINGS.body, preset: "gold", color: "#123456", finish: "matte" });
    expect(settings.lighting).toEqual({ ...DEFAULT_SETTINGS.lighting, azimuth: 25, environment: "golden" });
    expect(settings.tilt).toEqual({ pitch: 12, roll: 0 });
    expect(settings.water).toEqual(DEFAULT_SETTINGS.water);
    expect("oldField" in settings).toBe(false);
  });

  it("drops enum values the app no longer knows", () => {
    const settings = sanitizeSettings({ body: { preset: "chrome", finish: "mirror" }, lighting: { environment: "nightclub" }, background: { kind: "video" } });
    expect(settings.body.preset).toBe(DEFAULT_SETTINGS.body.preset);
    expect(settings.body.finish).toBe(DEFAULT_SETTINGS.body.finish);
    expect(settings.lighting.environment).toBe(DEFAULT_SETTINGS.lighting.environment);
    expect(settings.background.kind).toBe(DEFAULT_SETTINGS.background.kind);
  });

  it("never restores live image URLs or the water tool mode", () => {
    const settings = sanitizeSettings({ artwork: { url: "blob:http://x/1", name: "Label.png" }, background: { imageUrl: "data:image/png;base64,AA" }, water: { tool: "brush", density: 0.4 } });
    expect(settings.artwork.url).toBeNull();
    expect(settings.artwork.name).toBe("Label.png");
    expect(settings.background.imageUrl).toBeNull();
    expect(settings.water.tool).toBe("none");
    expect(settings.water.density).toBe(0.4);
  });

  it("keeps a focus point", () => {
    expect(sanitizeSettings({ effects: { focus: "point", focusPoint: [0, 0.05, 0.03] } }).effects.focusPoint).toEqual([0, 0.05, 0.03]);
  });
});

describe("sanitizeUi and sanitizeImages", () => {
  it("validates the scene UI", () => {
    expect(sanitizeUi({ sceneName: "  Summer IPA ", exportAspect: [16, 9], prompt: "beach", backgroundSource: "upload", dialog: "export" }, UI)).toEqual({
      sceneName: "Summer IPA",
      exportAspect: [16, 9],
      prompt: "beach",
      backgroundSource: "upload"
    });
    expect(sanitizeUi({ sceneName: "   ", exportAspect: [0, 5], backgroundSource: "camera" }, UI)).toEqual(UI);
  });

  it("keeps only IndexedDB references and plain URLs", () => {
    expect(sanitizeImages({ artwork: "idb:" + "a".repeat(64), background: "https://example.com/bg.jpg" })).toEqual({ artwork: "idb:" + "a".repeat(64), background: "https://example.com/bg.jpg" });
    expect(sanitizeImages({ artwork: "blob:http://x/1", background: "javascript:alert(1)" })).toEqual({ artwork: null, background: null });
    expect(sanitizeImages("nope")).toEqual({ artwork: null, background: null });
  });
});

describe("versions", () => {
  it("rejects data without a valid version", () => {
    expect(migrate({ settings: {} })).toBeNull();
    expect(migrate({ v: 0 })).toBeNull();
    expect(migrate({ v: "1" })).toBeNull();
    expect(migrate({ v: 1.5 })).toBeNull();
  });

  it("runs each migration step up to the target version", () => {
    const steps = {
      1: (d: Record<string, unknown>) => ({ ...d, settings: { ...(d.settings as object), spin: 90 } }),
      2: (d: Record<string, unknown>) => ({ ...d, settings: { ...(d.settings as object), lift: 5 } })
    };
    expect(migrate({ v: 1, settings: {} }, steps, 3)).toEqual({ v: 3, settings: { spin: 90, lift: 5 } });
    expect(migrate({ v: 2, settings: {} }, steps, 3)).toEqual({ v: 3, settings: { lift: 5 } });
  });

  it("merges data written by a newer build", () => {
    const scene = decodeScene(JSON.stringify({ v: SCHEMA_VERSION + 3, settings: { spin: 45, futureField: { a: 1 } }, ui: UI }), UI);
    expect(scene?.settings.spin).toBe(45);
    expect(scene?.settings).not.toHaveProperty("futureField");
  });
});

describe("decodeScene", () => {
  it("round-trips an encoded scene", () => {
    const settings = { ...DEFAULT_SETTINGS, spin: 30, body: { ...DEFAULT_SETTINGS.body, preset: "black" as const }, artwork: { ...DEFAULT_SETTINGS.artwork, url: "blob:x", name: "a.png" } };
    const images = { artwork: "idb:" + "b".repeat(64), background: null };
    const ui = { ...UI, sceneName: "Night" };
    const scene = decodeScene(JSON.stringify(encodeScene(settings, images, ui)), UI);
    expect(scene).toEqual({ settings: { ...settings, artwork: { ...settings.artwork, url: null } }, images, ui });
  });

  it("returns null for corrupted or unreadable data", () => {
    for (const raw of [null, "", "{", "not json", "null", "[]", "42", '"text"', '{"v":1,"settings":', JSON.stringify({ settings: {} })]) {
      expect(decodeScene(raw, UI)).toBeNull();
    }
  });

  it("falls back to defaults for sections with the wrong shape", () => {
    const scene = decodeScene(JSON.stringify({ v: 1, settings: { body: "silver", effects: [] }, images: 5, ui: "x" }), UI);
    expect(scene).toEqual({ settings: DEFAULT_SETTINGS, images: { artwork: null, background: null }, ui: UI });
  });
});

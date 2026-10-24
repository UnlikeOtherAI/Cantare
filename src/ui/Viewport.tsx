import { useEffect, useRef, useState } from "react";
import { CanStage, type StageInteraction } from "../engine/stage";
import { useEditor } from "../state/editor";
import { rememberWelcomed, useUi } from "../state/ui";
import { cancelGeneration } from "./generation";
import { Icon } from "./icons";
import { ANGLES, goToAngle } from "./panels/CameraPanel";
import { lightToDisc, useLightDrag } from "./panels/LightPanel";
import { loadSampleArtwork } from "./panels/ArtworkPanel";

let activeStage: CanStage | null = null;

/** The stage currently mounted, for export and camera commands. */
export function getStage() {
  return activeStage;
}

interface Overlay {
  can: { cx: number; cy: number; top: number; bottom: number; halfWidth: number };
  label: { top: number; bottom: number; left: number; right: number } | null;
  pxPerMm: number;
}

const ANGLE_NAMES: Record<string, string> = { front: "Front", "three-quarter": "¾", top: "Lid", hero: "Hero" };

export function Stage({ exporting }: { exporting: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const settings = useEditor((s) => s.settings);
  const patch = useEditor((s) => s.patch);
  const ui = useUi();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const stage = new CanStage(canvas);
    activeStage = stage;
    if (import.meta.env.DEV) Object.assign(window, { __stage: stage });
    stage.onInfo = (info) => useUi.getState().set({ info });
    stage.onView = (view) => useUi.getState().set({ view });
    stage.onFirstFrame = () => setTimeout(() => useUi.getState().set({ ready: true }), 150);
    stage.onArtworkDrag = (rotation, offset) => {
      const { settings, patch } = useEditor.getState();
      const a = settings.artwork;
      patch("artwork", { rotation: Math.round((a.rotation + rotation) * 10) / 10, offset: a.mode === "label" ? a.offset + offset : a.offset });
    };
    stage.onFocusPicked = (focusPoint) => {
      useEditor.getState().patch("effects", { focus: "point", focusPoint, dofEnabled: true });
      useUi.getState().set({ pickingFocus: false });
    };
    stage.onOrientationDrag = ({ pitch, spin, roll }) => {
      const { set } = useEditor.getState();
      set("tilt", { pitch: Math.round(pitch * 10) / 10, roll: Math.round(roll * 10) / 10 });
      set("spin", Math.round(spin));
    };
    stage.controls.addEventListener("start", () => useUi.getState().set({ angle: null }));
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) stage.resize(width, height);
    });
    observer.observe(canvas.parentElement!);
    void stage.apply(useEditor.getState().settings);
    return () => {
      observer.disconnect();
      stage.dispose();
      if (activeStage === stage) activeStage = null;
    };
  }, []);

  useEffect(() => {
    void activeStage?.apply(settings);
  }, [settings]);

  // What the stage tool claims: water painting, artwork drags, or a focus tap.
  const interaction: StageInteraction = ui.pickingFocus
    ? "focus"
    : ui.tool === "water" && settings.water.tool !== "none"
      ? "water"
      : ui.tool === "artwork" && settings.artwork.url
        ? "artwork"
        : "orbit";
  useEffect(() => activeStage?.setInteraction(interaction), [interaction]);
  useEffect(() => activeStage?.setGizmo(ui.tool === "camera"), [ui.tool]);

  // Keep the can centred in the part of the stage the sheet and HUD leave visible.
  useEffect(() => {
    const update = () => {
      const panel = document.querySelector(".panel");
      const compact = window.matchMedia("(max-width: 1024px)").matches;
      const sheet = compact && panel ? panel.getBoundingClientRect().height : 0;
      // At the full detent the HUDs step aside and the strip above the sheet is all preview.
      const full = compact && useUi.getState().sheet === "full";
      activeStage?.setInsets(full ? 12 : 56, sheet + (full ? 12 : 72));
    };
    update();
    const panel = document.querySelector(".panel");
    const observer = new ResizeObserver(update);
    if (panel) observer.observe(panel);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ui.sheet]);

  // Overlays follow the can on screen while a tool that needs them is open.
  const needsOverlay = ui.tool === "light" || ui.tool === "artwork" || ui.tool === "water";
  useEffect(() => {
    if (!needsOverlay) return;
    let frame = 0;
    let last = "";
    const loop = () => {
      const stage = activeStage;
      if (stage) {
        const next: Overlay = { can: stage.canScreenRect(), label: stage.labelScreenEdges(), pxPerMm: stage.pixelsPerMm() };
        const key = JSON.stringify(next, (_, v) => (typeof v === "number" ? Math.round(v * 2) / 2 : v));
        if (key !== last) {
          last = key;
          setOverlay(next);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [needsOverlay]);

  const lightDrag = useLightDrag((p) => patch("lighting", { azimuth: ((((p.azimuth + 180) % 360) + 360) % 360) - 180, elevation: p.elevation }), 0.475, 0.18);
  const gizmoRef = useRef<HTMLDivElement>(null);
  const gizmoSize = overlay ? Math.min(560, Math.max(260, overlay.can.halfWidth * 2 * 3.4)) : 0;
  const sun = lightToDisc(settings.lighting.azimuth, settings.lighting.elevation);
  const hx = 50 + 47.5 * sun.x;
  const hy = 50 + 18 * sun.y;
  const rayX = ((50 - hx) / 100) * gizmoSize;
  const rayY = ((50 - hy) / 100) * gizmoSize;

  const waterBrush = ui.tool === "water" && settings.water.tool !== "none";
  const label = ui.tool === "artwork" && overlay?.label;

  const resizeLabel = (edge: "top" | "bottom") => (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const info = useUi.getState().info;
    const start = { y: e.clientY, height: info?.placement?.height ?? 80, offset: useEditor.getState().settings.artwork.offset };
    const move = (ev: PointerEvent) => {
      const mm = (start.y - ev.clientY) / (overlay?.pxPerMm ?? 1);
      if (edge === "top") patch("artwork", { height: Math.max(10, start.height + mm) });
      else patch("artwork", { height: Math.max(10, start.height - mm), offset: start.offset + mm / 2 });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", () => el.removeEventListener("pointermove", move), { once: true });
  };

  const spinDrag = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, spin: useEditor.getState().settings.spin };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - start.x) > 3) moved = true;
      useEditor.getState().set("spin", Math.round((((start.spin + (ev.clientX - start.x) * 0.8) % 360) + 360) % 360));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener(
      "pointerup",
      () => {
        el.removeEventListener("pointermove", move);
        if (!moved) {
          const on = !useUi.getState().turntable;
          useUi.getState().set({ turntable: on });
          activeStage?.setTurntable(on);
        }
      },
      { once: true }
    );
  };

  const busy = ui.generation.status === "generating" ? "Generating background…" : exporting;

  return (
    <main
      ref={stageRef}
      className="stage"
      aria-label="3D viewport"
      data-cursor={cursor ? "shown" : "hidden"}
      onPointerMove={(e) => {
        if (!waterBrush) return;
        const b = stageRef.current!.getBoundingClientRect();
        setCursor({ x: e.clientX - b.left, y: e.clientY - b.top });
      }}
      onPointerLeave={() => setCursor(null)}
    >
      <canvas ref={canvasRef} className="stage__canvas" />

      {ui.tool === "light" && overlay && (
        <div ref={gizmoRef} className="gizmo gizmo--light" style={{ opacity: 1, left: overlay.can.cx, top: overlay.can.cy, width: gizmoSize, transform: "translate(-50%, -50%)" }} aria-hidden="true">
          <svg className="gizmo__ring" viewBox="0 0 400 400">
            <ellipse cx="200" cy="200" rx="190" ry="72" />
            <ellipse cx="200" cy="200" rx="190" ry="72" className="gizmo__ring-front" />
          </svg>
          <div
            className="gizmo__handle"
            role="slider"
            tabIndex={0}
            aria-label="Key light direction"
            aria-valuetext={`Azimuth ${settings.lighting.azimuth}°, elevation ${settings.lighting.elevation}°`}
            style={{ ["--hx" as string]: `${hx}%`, ["--hy" as string]: `${hy}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              lightDrag(gizmoRef.current!, e, e.currentTarget as HTMLElement);
            }}
          >
            <span className="gizmo__ray" style={{ ["--ray-rot" as string]: `${(Math.atan2(rayY, rayX) * 180) / Math.PI}deg`, ["--ray" as string]: `${Math.hypot(rayX, rayY) * 0.82}px` }} />
            <span className="gizmo__tip" data-text={`${settings.lighting.azimuth}° · ${settings.lighting.elevation}°`} />
          </div>
        </div>
      )}

      {waterBrush && cursor && overlay && (
        <div
          className="brush-cursor"
          style={{
            opacity: 1,
            left: cursor.x,
            top: cursor.y,
            ["--brush" as string]: `${settings.water.brush * overlay.pxPerMm}px`,
            borderStyle: settings.water.tool === "spray" ? "dashed" : undefined,
            borderColor: settings.water.tool === "erase" ? "var(--c-text-2)" : undefined,
            background: settings.water.tool === "erase" ? "transparent" : undefined
          }}
        />
      )}

      {label && (
        <div className="label-handles" style={{ opacity: 1 }} aria-hidden="true">
          <div className="label-handles__edge" style={{ top: label.top, width: label.right - label.left + 24, left: (label.left + label.right) / 2 }} onPointerDown={resizeLabel("top")}>
            <span />
          </div>
          <div className="label-handles__edge" style={{ top: label.bottom, width: label.right - label.left + 24, left: (label.left + label.right) / 2 }} onPointerDown={resizeLabel("bottom")}>
            <span />
          </div>
        </div>
      )}

      <div className="hud hud--angles" role="toolbar" aria-label="Quick angles">
        {ANGLES.map((a) => (
          <button key={a.value} className={`chip chip--glass${ui.angle === a.value ? " is-active" : ""}`} type="button" onClick={() => goToAngle(a.value)}>
            <Icon name={a.icon} className="chip__icon" />
            {a.label}
          </button>
        ))}
      </div>

      {ui.pickingFocus && <div className="hud hud--focus">Tap the can to set focus</div>}

      <div className="hud hud--bottom" role="toolbar" aria-label="View">
        <button className={`icon-btn icon-btn--glass${ui.turntable ? " is-active" : ""}`} type="button" title="Spin can: drag sideways, or click for turntable" onPointerDown={spinDrag} style={ui.turntable ? { color: "var(--c-accent)" } : undefined}>
          <Icon name="spin" />
        </button>
        <button className="icon-btn icon-btn--glass" type="button" title="Frame can (double-click the stage)" onClick={() => activeStage?.frameCan()}>
          <Icon name="fit" />
        </button>
        <button className="icon-btn icon-btn--glass" type="button" title="Reset view (R)" onClick={() => goToAngle("three-quarter")}>
          <Icon name="reset" />
        </button>
        <span className="hud__sep" />
        <button
          className="icon-btn icon-btn--glass"
          type="button"
          title={settings.background.visible ? "Hide background" : "Show background"}
          aria-pressed={!settings.background.visible}
          style={settings.background.visible ? undefined : { color: "var(--c-text-3)" }}
          onClick={() => patch("background", { visible: !settings.background.visible })}
        >
          <Icon name="eye" />
        </button>
        <span className="hud__readout mono">
          {ui.angle ? ANGLE_NAMES[ui.angle] : `${ui.view.elevation}°`} · {ui.view.focalLength} mm
        </span>
      </div>

      {busy && (
        <div className="hud hud--status">
          <span className="spinner" aria-hidden="true" />
          <span>{busy}</span>
          {ui.generation.status === "generating" && (
            <button className="link-btn" type="button" onClick={cancelGeneration}>
              Cancel
            </button>
          )}
        </div>
      )}

      {ui.welcome && ui.ready && !settings.artwork.url && (
        <aside className="welcome">
          <h2 className="welcome__title">Put your artwork on it.</h2>
          <p className="welcome__body">Drop a PNG or JPEG of your label or full print. Cantare wraps it on the can you choose, true to its real dimensions.</p>
          <div className="welcome__actions">
            <button className="btn btn--primary" type="button" onClick={() => ui.setTool("artwork")}>
              <Icon name="upload" className="btn__icon" />
              Upload artwork
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => ui.setTool("can")}>
              Choose a can
            </button>
            <button className="link-btn" type="button" onClick={loadSampleArtwork}>
              Try a sample
            </button>
          </div>
          <button
            className="icon-btn welcome__close"
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              rememberWelcomed();
              ui.set({ welcome: false });
            }}
          >
            <Icon name="close" />
          </button>
        </aside>
      )}

      {ui.generation.status === "generating" && <div className="gen-shimmer" />}
    </main>
  );
}

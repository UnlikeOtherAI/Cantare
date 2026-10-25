import { useEffect, useRef, useState, type ReactNode } from "react";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./tokens.css";
import "./styles.css";
import { getFormat } from "../engine/formats";
import { generationAvailable } from "../platform/api";
import { listGallery } from "../platform/gallery";
import { useEditor } from "../state/editor";
import { TOOLS, useUi, type Sheet, type Tool } from "../state/ui";
import { ExportDialog } from "./ExportDialog";
import { downloadMockup } from "./mockup";
import { GalleryDialog } from "./GalleryDialog";
import { Icon, IconSprite, type IconName } from "./icons";
import { ArtworkPanel } from "./panels/ArtworkPanel";
import { ANGLES, CameraPanel, goToAngle } from "./panels/CameraPanel";
import { CanPanel, formatTitle } from "./panels/CanPanel";
import { ColourPanel } from "./panels/ColourPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { LightPanel } from "./panels/LightPanel";
import { ScenePanel } from "./panels/ScenePanel";
import { WaterPanel } from "./panels/WaterPanel";
import { PanelHead } from "./controls";
import { REPO_URL, SceneMenu } from "./SceneMenu";
import { SetupsDialog } from "./SetupsDialog";
import { getStage, Stage } from "./Viewport";

const TOOL_META: Record<Tool, { label: string; title: string; icon: IconName; panel: () => ReactNode; flush?: boolean }> = {
  can: { label: "Can", title: "Can", icon: "can", panel: CanPanel },
  colour: { label: "Colour", title: "Colour & finish", icon: "colour", panel: ColourPanel },
  artwork: { label: "Artwork", title: "Artwork", icon: "artwork", panel: ArtworkPanel },
  light: { label: "Light", title: "Light", icon: "light", panel: LightPanel },
  water: { label: "Water", title: "Water", icon: "water", panel: WaterPanel },
  camera: { label: "Camera", title: "Camera", icon: "camera", panel: CameraPanel },
  effects: { label: "Effects", title: "Effects", icon: "effects", panel: EffectsPanel, flush: true },
  background: { label: "Scene", title: "Scene", icon: "background", panel: ScenePanel }
};

const compact = () => window.matchMedia("(max-width: 1024px)").matches;

function SheetHandle() {
  const set = useUi((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="panel__handle"
      aria-hidden="true"
      onPointerDown={(e) => {
        const el = ref.current!;
        const app = el.closest(".app") as HTMLElement;
        const panel = el.closest(".panel") as HTMLElement;
        const startY = e.clientY;
        const startH = panel.getBoundingClientRect().height;
        let moved = false;
        el.setPointerCapture(e.pointerId);
        app.classList.add("is-dragging");
        const move = (ev: PointerEvent) => {
          if (Math.abs(ev.clientY - startY) > 4) moved = true;
          app.style.setProperty("--sheet-h", `${Math.min(innerHeight * 0.62, Math.max(56, startH + startY - ev.clientY))}px`);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener(
          "pointerup",
          (ev) => {
            el.removeEventListener("pointermove", move);
            app.classList.remove("is-dragging");
            app.style.removeProperty("--sheet-h");
            const current = useUi.getState().sheet;
            if (!moved) {
              set({ sheet: ({ peek: "half", half: "full", full: "peek" } as Record<Sheet, Sheet>)[current] });
              return;
            }
            const h = startH + startY - ev.clientY;
            set({ sheet: h < innerHeight * 0.25 ? "peek" : h < innerHeight * 0.53 ? "half" : "full" });
          },
          { once: true }
        );
      }}
    >
      <span />
    </div>
  );
}

export function App() {
  const ui = useUi();
  const settings = useEditor((s) => s.settings);
  const { undo, redo, past, future } = useEditor();
  const [exporting, setExporting] = useState<string | null>(null);
  const format = getFormat(settings.formatId);
  const meta = TOOL_META[ui.tool];
  const Panel = meta.panel;

  useEffect(() => {
    listGallery()
      .then((items) => useUi.getState().set({ galleryCount: items.length }))
      .catch(() => undefined);
    generationAvailable().then((ok) => useUi.getState().set({ generationAvailable: ok }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (target.matches("input, textarea")) return;
        e.preventDefault();
        if (e.shiftKey) useEditor.getState().redo();
        else useEditor.getState().undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        useUi.getState().set({ dialog: "export" });
        return;
      }
      if (e.key === "Escape") {
        useUi.getState().set({ dialog: null, pickingFocus: false });
        return;
      }
      if (target.matches("input, textarea, select") || mod || e.altKey) return;
      if (/^[1-8]$/.test(e.key)) useUi.getState().setTool(TOOLS[Number(e.key) - 1]);
      const angle = ANGLES.find((a) => a.key === e.key.toLowerCase());
      if (angle) goToAngle(angle.value);
      if (e.key.toLowerCase() === "r") goToAngle("three-quarter");
      if (e.key === " ") {
        e.preventDefault();
        const on = !useUi.getState().turntable;
        useUi.getState().set({ turntable: on });
        getStage()?.setTurntable(on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pickTool = (tool: Tool, from: "rail" | "strip") => {
    if (tool === ui.tool) {
      if (from === "strip" || compact()) ui.set({ sheet: ui.sheet === "peek" ? "half" : "peek" });
      else ui.set({ collapsed: !ui.collapsed });
      return;
    }
    ui.setTool(tool);
  };

  return (
    <div className={`app${ui.collapsed ? " is-collapsed" : ""}`} data-tool={ui.tool} data-sheet={ui.sheet}>
      <IconSprite />
      <header className="topbar">
        <div className="topbar__left">
          <span className="brand" aria-label="Cantare">
            Cantare
          </span>
        </div>
        <div className="topbar__centre">
          <SceneMenu format={formatTitle(format)} />
        </div>
        <div className="topbar__right">
          <a className="icon-btn topbar__github" href={REPO_URL} target="_blank" rel="noopener noreferrer" title="Source on GitHub" aria-label="Source on GitHub">
            <Icon name="github" />
          </a>
          <div className="btn-group" role="group" aria-label="History">
            <button className="icon-btn" type="button" title="Undo (⌘Z)" disabled={!past.length} onClick={undo}>
              <Icon name="undo" />
            </button>
            <button className="icon-btn" type="button" title="Redo (⇧⌘Z)" disabled={!future.length} onClick={redo}>
              <Icon name="redo" />
            </button>
          </div>
          <button className="icon-btn topbar__mockup" type="button" title="Download mock-up: the live view, instantly" aria-label="Download mock-up" onClick={downloadMockup}>
            <Icon name="download" />
          </button>
          <button className="icon-btn" type="button" title="Gallery" onClick={() => ui.set({ dialog: "gallery", toast: null })}>
            <Icon name="gallery" />
            {ui.galleryCount > 0 && <span className="badge">{ui.galleryCount}</span>}
          </button>
          <button className="btn btn--primary" type="button" onClick={() => ui.set({ dialog: "export" })} title="Export (⌘E)">
            <Icon name="export" className="btn__icon" />
            <span>Export</span>
          </button>
        </div>
      </header>

      <Stage exporting={exporting} />

      <nav className="rail" aria-label="Tools">
        {TOOLS.map((tool, i) => (
          <button key={tool} className={`rail__item${ui.tool === tool ? " is-active" : ""}`} type="button" aria-label={TOOL_META[tool].title} aria-pressed={ui.tool === tool} onClick={() => pickTool(tool, "rail")}>
            <Icon name={TOOL_META[tool].icon} />
            <span>{TOOL_META[tool].label}</span>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </nav>

      <aside className="panel">
        <SheetHandle />
        <section className="tool is-active" key={ui.tool}>
          <PanelHead title={meta.title} onCollapse={() => ui.set({ collapsed: true })} />
          <div className={`panel__body${meta.flush ? " panel__body--flush" : ""}`}>
            <Panel />
          </div>
        </section>
      </aside>

      <nav className="toolstrip" aria-label="Tools">
        {TOOLS.map((tool) => (
          <button key={tool} className={`toolstrip__item${ui.tool === tool ? " is-active" : ""}`} type="button" aria-label={TOOL_META[tool].title} aria-pressed={ui.tool === tool} onClick={() => pickTool(tool, "strip")}>
            <Icon name={TOOL_META[tool].icon} />
            <span>{TOOL_META[tool].label}</span>
          </button>
        ))}
      </nav>

      {ui.dialog === "export" && <ExportDialog onClose={() => ui.set({ dialog: null })} onBusy={setExporting} />}
      {ui.dialog === "gallery" && <GalleryDialog onClose={() => ui.set({ dialog: null })} />}
      {(ui.dialog === "setups" || ui.dialog === "save-setup") && <SetupsDialog key={ui.dialog} mode={ui.dialog === "save-setup" ? "save" : "list"} onClose={() => ui.set({ dialog: null })} />}

      {ui.toast && !ui.dialog && (
        <div className={`toast${ui.toast.tone === "danger" ? " toast--danger" : ""}`} role="status" key={ui.toast.id}>
          <Icon name={ui.toast.tone === "ok" ? "check" : "alert"} className={`toast__icon${ui.toast.tone === "ok" ? " toast__icon--ok" : ""}`} />
          <span className="toast__text">{ui.toast.text}</span>
          {ui.toast.action && (
            <button
              className="link-btn"
              type="button"
              onClick={() => {
                ui.toast?.action?.run();
                ui.set({ toast: null });
              }}
            >
              {ui.toast.action.label}
            </button>
          )}
        </div>
      )}

      {!ui.ready && (
        <div className="splash">
          <div className="splash__mark">Cantare</div>
          <div className="splash__bar">
            <span />
          </div>
          <div className="splash__sub">Compiling shaders…</div>
        </div>
      )}
    </div>
  );
}

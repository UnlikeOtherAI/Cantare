import { useEffect, useRef, useState } from "react";
import { addToGallery } from "../platform/gallery";
import { canShare, isNative, saveImage, shareImage } from "../platform/save";
import { useEditor } from "../state/editor";
import { useUi } from "../state/ui";
import { Field, RowToggle, Seg, Slider } from "./controls";
import { Icon } from "./icons";
import { formatTitle } from "./panels/CanPanel";
import { getStage } from "./Viewport";
import { RenderProgress, rememberDeviceStats, renderEstimate, type RenderState } from "./RenderProgress";

const ASPECTS: [number, number][] = [
  [1, 1],
  [4, 5],
  [3, 4],
  [16, 9],
  [9, 16]
];
const SIZES = [1024, 2048, 4096, 6144];

type Phase = { name: "settings" } | { name: "progress" } | { name: "done"; blob: Blob; filename: string };
type Mode = "quick" | "photoreal";
type Status = { text: string; detail: string };

const PASSES = [128, 256, 512];
const MODE_KEY = "cantare.exportMode";

function storedMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "quick" || stored === "photoreal") return stored;
  } catch {
    // Private mode: fall through to the default.
  }
  return isNative ? "quick" : "photoreal";
}

function dims([w, h]: [number, number], long: number) {
  return w >= h ? { width: long, height: Math.round((long * h) / w) } : { width: Math.round((long * w) / h), height: long };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scene";

export function ExportDialog({ onClose, onBusy }: { onClose(): void; onBusy(text: string | null): void }) {
  const aspect = useUi((s) => s.exportAspect);
  const setUi = useUi((s) => s.set);
  const showToast = useUi((s) => s.showToast);
  const sceneName = useUi((s) => s.sceneName);
  const settings = useEditor((s) => s.settings);
  const [size, setSize] = useState(2048);
  const [type, setType] = useState<"image/png" | "image/jpeg">("image/png");
  const [quality, setQuality] = useState(92);
  const [transparent, setTransparent] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "settings" });
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<Mode>(storedMode);
  // Phones get fewer passes by default: same look, a little more grain, much less waiting.
  const [passes, setPasses] = useState(isNative || /iPhone|iPad|Android/i.test(navigator.userAgent) ? 128 : 256);
  const [status, setStatus] = useState<Status>({ text: "", detail: "" });
  const [render, setRender] = useState<RenderState | null>(null);
  const abort = useRef<AbortController | null>(null);
  const max = getStage()?.maxExportSize() ?? 4096;
  const { width, height } = dims(aspect, Math.min(size, max));
  const ext = type === "image/png" ? "png" : "jpg";
  const label = type === "image/png" ? "PNG" : "JPEG";
  const alpha = transparent && type === "image/png";
  const previewUrl = useRef<string | null>(null);

  // A real, small render of exactly what will be exported.
  useEffect(() => {
    if (phase.name !== "settings") return;
    const timer = setTimeout(async () => {
      const stage = getStage();
      if (!stage) return;
      const small = dims(aspect, 640);
      const blob = await stage.exportImage({ ...small, type: "image/png", transparent: alpha });
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(blob);
      setPreview(previewUrl.current);
    }, 120);
    return () => clearTimeout(timer);
  }, [aspect, alpha, phase.name, settings]);

  useEffect(() => () => void (previewUrl.current && URL.revokeObjectURL(previewUrl.current)), []);

  // Start compiling the photoreal renderer while the user picks settings.
  useEffect(() => {
    if (mode === "photoreal") getStage()?.warmFinalRender();
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }, [mode]);

  const run = async () => {
    const stage = getStage();
    if (!stage) return;
    setPhase({ name: "progress" });
    setProgress(mode === "quick" ? 8 : 0);
    onBusy(`Rendering ${width} × ${height}…`);
    const controller = new AbortController();
    abort.current = controller;
    const tick = mode === "quick" ? setInterval(() => setProgress((p) => Math.min(92, p + 6)), 120) : undefined;
    try {
      // Let the progress state paint before the GPU work starts.
      await new Promise((r) => setTimeout(r, 60));
      let blob: Blob;
      if (mode === "quick") {
        setStatus({ text: `Rendering ${width} × ${height}`, detail: `Rendered on this device · ${label}` });
        blob = await stage.exportImage({ width, height, type, quality: quality / 100, transparent: alpha });
      } else {
        const startedAt = performance.now();
        let gpu: string | null = null;
        let prepStart = 0;
        setRender({ step: "scene", startedAt, gpu, traceStartedAt: null, done: 0, total: passes });
        blob = await stage.renderFinal({
          width,
          height,
          type,
          quality: quality / 100,
          transparent: alpha,
          samples: passes,
          signal: controller.signal,
          onDevice: (name) => {
            gpu = name;
            setRender((r) => r && { ...r, gpu: name });
          },
          onStage: (step) => {
            if (step === "preparing") {
              // Timed from the user's side, including any wait behind the warm-up.
              if (!prepStart) prepStart = performance.now();
              setRender((r) => r && { ...r, step: "prepare" });
              onBusy("Starting the photoreal renderer…");
            } else {
              if (gpu) rememberDeviceStats(gpu, { prepMs: performance.now() - prepStart });
              setRender((r) => r && { ...r, step: "trace", traceStartedAt: performance.now() });
            }
          },
          onProgress: (done, total) => {
            setRender((r) => r && { ...r, done, total, step: done >= total ? "finish" : "trace" });
            onBusy(`Tracing light ${Math.round((done / total) * 100)}%…`);
          }
        });
        setRender((r) => {
          if (r?.traceStartedAt && gpu) {
            const seconds = (performance.now() - r.traceStartedAt) / 1000;
            // Normalised to a 2048 × 2560 frame so estimates carry across sizes.
            rememberDeviceStats(gpu, { passesPerSecond: (passes / Math.max(0.1, seconds)) * ((width * height) / (2048 * 2560)) });
          }
          return r && { ...r, step: "finish" };
        });
      }
      const format = useUi.getState().info?.format;
      const filename = `cantare-${slug(sceneName)}-${format ? slug(format.name) : "can"}-${width}x${height}.${ext}`;
      setProgress(100);
      await addToGallery({ blob, width, height, type, title: `${sceneName} · ${format ? formatTitle(format) : ""}` });
      setUi({ galleryCount: useUi.getState().galleryCount + 1 });
      const result = await saveImage(blob, filename);
      setPhase({ name: "done", blob, filename });
      showToast({ text: result === "saved" ? "Saved to Photos and gallery" : "Saved to gallery", tone: "ok", action: { label: "Open", run: () => setUi({ dialog: "gallery" }) } });
    } catch (error) {
      setPhase({ name: "settings" });
      if (error instanceof DOMException && error.name === "AbortError") return;
      const denied = error instanceof Error && /denied|permission/i.test(error.message);
      showToast({
        text: denied ? "Couldn't save — allow Photos access for Cantare in Settings" : "Couldn't save — try again",
        tone: "danger",
        action: denied ? undefined : { label: "Retry", run }
      });
    } finally {
      clearInterval(tick);
      abort.current = null;
      setRender(null);
      onBusy(null);
    }
  };

  const sizeMb = phase.name === "done" ? (phase.blob.size / 1024 / 1024).toFixed(1) : "";
  return (
    <div className="dialog-scrim" onClick={(e) => e.target === e.currentTarget && phase.name !== "progress" && onClose()}>
      <div className="dialog dialog--export" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header className="dialog__head">
          <h2 className="dialog__title" id="export-title">
            Export
          </h2>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose} disabled={phase.name === "progress"}>
            <Icon name="close" />
          </button>
        </header>
        <div className="dialog__body export">
          <div className="export__preview">
            <div className="export__frame" style={{ ["--ar" as string]: `${aspect[0]}/${aspect[1]}` }}>
              {preview ? <img src={preview} alt="Export preview" /> : <div className="export__frame-art" />}
              <span className="export__frame-size mono">
                {width} × {height}
              </span>
            </div>
          </div>

          {phase.name === "settings" && (
            <div className="export__settings">
              <Field label="Aspect">
                <Seg
                  size="sm"
                  label="Aspect"
                  options={ASPECTS.map((a) => ({ value: a.join(":"), label: a.join(":") }))}
                  value={aspect.join(":")}
                  onChange={(v) => setUi({ exportAspect: v.split(":").map(Number) as [number, number] })}
                />
              </Field>
              <Field label="Size">
                <Seg
                  size="sm"
                  label="Size"
                  options={SIZES.map((s) => ({ value: String(s), label: String(s), title: s > max ? `This device renders up to ${max} px` : undefined }))}
                  value={String(Math.min(size, max) === size ? size : SIZES.filter((s) => s <= max).pop())}
                  onChange={(v) => setSize(Math.min(Number(v), max))}
                />
                <p className="help">Longest edge, px. {max < 6144 ? `This device renders up to ${max} px.` : "Large sizes take a few seconds."}</p>
              </Field>
              <Field label="Quality">
                <Seg<Mode>
                  size="sm"
                  label="Quality"
                  options={[
                    { value: "photoreal", label: "Photoreal", title: "Path traced: real reflections and soft light. Takes longer." },
                    { value: "quick", label: "Mock-up", title: "Exactly what you see on the stage, in a second or two." }
                  ]}
                  value={mode}
                  onChange={setMode}
                />
                {mode === "photoreal" && (
                  <Seg
                    size="sm"
                    label="Passes"
                    options={PASSES.map((p) => ({ value: String(p), label: `${p} passes` }))}
                    value={String(passes)}
                    onChange={(v) => setPasses(Number(v))}
                  />
                )}
                <p className="help">
                  {mode === "photoreal"
                    ? `Traces light through the scene for the final image. More passes are cleaner and slower. ${renderEstimate(passes, width * height)}`
                    : "The live view at full size, ready in a second or two. Good for quick mock-ups and approvals."}
                </p>
              </Field>
              <Field label="Format">
                <Seg<"image/png" | "image/jpeg">
                  size="sm"
                  label="Format"
                  options={[
                    { value: "image/png", label: "PNG" },
                    { value: "image/jpeg", label: "JPEG" }
                  ]}
                  value={type}
                  onChange={setType}
                />
              </Field>
              {type === "image/jpeg" ? (
                <Slider label="Quality" unit="%" min={60} max={100} value={quality} onChange={setQuality} />
              ) : (
                <RowToggle title="Transparent background" hint="PNG only · keeps the shadow as alpha" checked={transparent} onChange={setTransparent} />
              )}
              <div className="dialog__actions">
                <button className="btn btn--primary btn--lg" type="button" onClick={run}>
                  <Icon name="download" className="btn__icon" />
                  {mode === "photoreal" ? (isNative ? "Render and save to Photos" : `Render and download ${label}`) : isNative ? "Save mock-up to Photos" : `Download mock-up ${label}`}
                </button>
              </div>
            </div>
          )}

          {phase.name === "progress" && (
            <div className="export__settings">
              {render ? (
                <RenderProgress state={render} onCancel={() => abort.current?.abort()} />
              ) : (
                <div className="progress progress--lg">
                  <div className="progress__row">
                    <span>{status.text}</span>
                    <span className="mono">{progress}%</span>
                  </div>
                  <div className="progress__bar">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress__row progress__row--sub">
                    <span>{status.detail}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase.name === "done" && (
            <div className="export__settings export__done">
              <div className="done-mark">
                <Icon name="check" />
              </div>
              <div className="done-text">
                <strong>{isNative ? "Saved to Photos" : "Downloaded"} and kept in the gallery</strong>
                <span className="mono">
                  {phase.filename} · {sizeMb} MB
                </span>
              </div>
              <div className="dialog__actions dialog__actions--row">
                <button className="btn btn--primary" type="button" onClick={() => saveImage(phase.blob, phase.filename)}>
                  <Icon name="download" className="btn__icon" />
                  {isNative ? "Save again" : "Download again"}
                </button>
                {canShare() && (
                  <button className="btn btn--ghost" type="button" onClick={() => shareImage(phase.blob, phase.filename).catch(() => undefined)}>
                    <Icon name="share" className="btn__icon" />
                    Share
                  </button>
                )}
              </div>
              <button className="link-btn" type="button" onClick={() => setPhase({ name: "settings" })}>
                Export another size
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

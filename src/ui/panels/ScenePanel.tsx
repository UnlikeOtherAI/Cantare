import { useEffect, useState } from "react";
import type { BackgroundSettings } from "../../engine/settings";
import { listRecentBackgrounds, type RecentBackground } from "../../platform/gallery";
import { useEditor } from "../../state/editor";
import { useUi, type BackgroundSource } from "../../state/ui";
import { ColourPopover, Dropzone, Field, Group, RowToggle, Seg, Slider } from "../controls";
import { backgroundShape, cancelGeneration, startGeneration, applyBackgroundImage } from "../generation";
import { Icon } from "../icons";
import { getStage } from "../Viewport";

const SUGGESTIONS = [
  "Wet slate bar top at night, warm bokeh lights behind",
  "Sunlit wooden picnic table in a beer garden",
  "White marble kitchen counter, soft morning window light",
  "Crushed ice in a steel bucket, close-up",
  "Festival stage at dusk, string lights out of focus",
  "Minimal seamless studio sweep in deep teal"
];

const COLOUR_PRESETS: { label: string; patch: Partial<BackgroundSettings> }[] = [
  { label: "Studio grey", patch: { kind: "studio", color: "#34373c", color2: "#0f1012" } },
  { label: "White sweep", patch: { kind: "studio", color: "#f4f4f2", color2: "#c9cacc" } },
  { label: "Charcoal", patch: { kind: "solid", color: "#1b1c1f" } }
];

function useRecent(refresh: unknown) {
  const [items, setItems] = useState<{ item: RecentBackground; url: string }[]>([]);
  useEffect(() => {
    let urls: string[] = [];
    listRecentBackgrounds()
      .then((list) => {
        const mapped = list.slice(0, 4).map((item) => ({ item, url: URL.createObjectURL(item.blob) }));
        urls = mapped.map((m) => m.url);
        setItems(mapped);
      })
      .catch(() => setItems([]));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [refresh]);
  return items;
}

function Generate() {
  const { prompt, generation, exportAspect, generationAvailable } = useUi();
  const setUi = useUi((s) => s.set);
  const [online, setOnline] = useState(navigator.onLine);
  const [progress, setProgress] = useState(0);
  const recent = useRecent(generation.status);
  const imageUrl = useEditor((s) => s.settings.background.imageUrl);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // The service reports no progress; ease towards 95% over the typical 25 s.
  useEffect(() => {
    if (generation.status !== "generating") return;
    const timer = setInterval(() => setProgress(Math.min(95, ((Date.now() - generation.startedAt) / 25000) * 90)), 250);
    return () => clearInterval(timer);
  }, [generation]);

  // Not offered yet where the server has no image service behind it.
  if (generationAvailable === false) {
    return (
      <Group>
        <div className="soon">
          <span className="soon__badge">Coming soon</span>
          <h3 className="soon__title">AI-generated backgrounds</h3>
          <p className="soon__text">Describe a scene and get a matching backdrop for your can. For now, upload your own photo or use a colour.</p>
          <div className="soon__actions">
            <button className="btn btn--sm" type="button" onClick={() => setUi({ backgroundSource: "upload" })}>
              Upload a photo
            </button>
            <button className="btn btn--sm" type="button" onClick={() => setUi({ backgroundSource: "colour" })}>
              Use a colour
            </button>
          </div>
        </div>
      </Group>
    );
  }

  const shape = backgroundShape(exportAspect);
  return (
    <Group>
      <div className="prompt">
        <textarea
          className="prompt__input"
          rows={3}
          maxLength={600}
          placeholder="Describe the scene: a wet slate bar top at night, warm bokeh behind…"
          value={prompt}
          onChange={(e) => setUi({ prompt: e.target.value })}
        />
        <div className="prompt__foot">
          <span className="mono">{prompt.length} / 600</span>
          <span className="mono" title="Follows the export aspect">
            {shape === "portrait" ? "1024 × 1536" : shape === "landscape" ? "1536 × 1024" : "1024 × 1024"}
          </span>
        </div>
      </div>
      <div className="chips chips--scroll" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip chip--suggest" type="button" onClick={() => setUi({ prompt: s })}>
            {s.split(",")[0]}
          </button>
        ))}
      </div>

      {generation.status === "generating" ? (
        <div className="progress">
          <div className="progress__row">
            <span>Generating…</span>
            <span className="mono">{Math.round(progress)}%</span>
          </div>
          <div className="progress__bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="progress__row progress__row--sub">
            <span>Usually 15–30 s. You can keep editing the can.</span>
            <button className="link-btn" type="button" onClick={cancelGeneration}>
              Cancel
            </button>
          </div>
        </div>
      ) : generation.status === "error" ? (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert" />
          <div>
            <strong>Generation failed.</strong> {generation.message} Your prompt is kept.
          </div>
          <button className="btn btn--sm" type="button" onClick={startGeneration}>
            Retry
          </button>
        </div>
      ) : !online ? (
        <button className="btn btn--block" type="button" disabled>
          Offline — generation needs a connection
        </button>
      ) : (
        <button className="btn btn--primary btn--block" type="button" disabled={prompt.trim().length < 3} onClick={startGeneration}>
          <Icon name="sparkle" className="btn__icon" />
          Generate background
        </button>
      )}

      {recent.length > 0 && (
        <>
          <div className="group__head">
            <h3 className="group__title">Recent</h3>
            <span className="group__hint">Tap to reuse</span>
          </div>
          <div className="thumbs">
            {recent.map(({ item, url }) => (
              <button
                key={item.id}
                className={`thumb${imageUrl === url ? " is-active" : ""}`}
                type="button"
                title={item.prompt}
                onClick={() => applyBackgroundImage(URL.createObjectURL(item.blob))}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
    </Group>
  );
}

function Upload() {
  const bg = useEditor((s) => s.settings.background);
  const patch = useEditor((s) => s.patch);
  return (
    <Group>
      <Dropzone
        title="Drop a photo or tap to choose"
        hint="JPEG or PNG · larger than your export is best"
        accept="image/png,image/jpeg,image/webp"
        onFile={(file) => applyBackgroundImage(URL.createObjectURL(file))}
      />
      <Field label="Fit" seg>
        <Seg
          size="sm"
          label="Fit"
          options={[
            { value: "fill", label: "Fill" },
            { value: "fit", label: "Fit" }
          ]}
          value={bg.fit}
          onChange={(fit) => patch("background", { fit })}
        />
      </Field>
      <Slider label="Blur" unit="%" min={0} max={100} value={Math.round(bg.blur * 100)} onChange={(v) => patch("background", { blur: v / 100 })} />
    </Group>
  );
}

function Colour() {
  const bg = useEditor((s) => s.settings.background);
  const body = useEditor((s) => s.settings.body);
  const patch = useEditor((s) => s.patch);
  const [editing, setEditing] = useState<"color" | "color2" | null>(null);
  const gradient = bg.kind === "gradient" || bg.kind === "studio";
  return (
    <Group>
      <Seg
        size="sm"
        label="Colour type"
        options={[
          { value: "solid", label: "Solid" },
          { value: "gradient", label: "Gradient" }
        ]}
        value={gradient ? "gradient" : "solid"}
        onChange={(v) => patch("background", { kind: v })}
      />
      <div className="grad-stops">
        <button className="swatch swatch--lg" type="button" style={{ ["--swatch" as string]: bg.color }} aria-label="First colour" onClick={() => setEditing(editing === "color" ? null : "color")} />
        {gradient && (
          <>
            <div className="grad-stops__bar" style={{ background: `linear-gradient(90deg, ${bg.color}, ${bg.color2})` }} />
            <button className="swatch swatch--lg" type="button" style={{ ["--swatch" as string]: bg.color2 }} aria-label="Second colour" onClick={() => setEditing(editing === "color2" ? null : "color2")} />
          </>
        )}
      </div>
      {editing && <ColourPopover value={bg[editing]} onChange={(hex) => patch("background", { [editing]: hex, kind: bg.kind === "studio" ? "gradient" : bg.kind })} onDone={() => setEditing(null)} />}
      {bg.kind === "gradient" && <Slider label="Angle" unit="°" min={0} max={360} value={bg.angle} onChange={(angle) => patch("background", { angle })} />}
      <div className="chips">
        {COLOUR_PRESETS.map((p) => (
          <button key={p.label} className="chip" type="button" onClick={() => patch("background", { ...p.patch, visible: true })}>
            {p.label}
          </button>
        ))}
        <button
          className="chip"
          type="button"
          title="Use the can's body colour"
          onClick={() => patch("background", { kind: "solid", color: body.preset === "custom" ? body.color : "#34373c", visible: true })}
        >
          Brand
        </button>
      </div>
    </Group>
  );
}

export function ScenePanel() {
  const source = useUi((s) => s.backgroundSource);
  const setUi = useUi((s) => s.set);
  const lighting = useEditor((s) => s.settings.lighting);
  const fx = useEditor((s) => s.settings.effects);
  const bg = useEditor((s) => s.settings.background);
  const patch = useEditor((s) => s.patch);
  return (
    <>
      <Seg<BackgroundSource>
        label="Background source"
        options={[
          { value: "generate", label: "Generate", icon: "sparkle" },
          { value: "upload", label: "Upload" },
          { value: "colour", label: "Colour" }
        ]}
        value={source}
        onChange={(backgroundSource) => setUi({ backgroundSource })}
      />
      {source === "generate" && <Generate />}
      {source === "upload" && <Upload />}
      {source === "colour" && <Colour />}

      <Group title="Match the scene">
        <RowToggle
          title="Match light to background"
          hint="Aims the key light and reflections from the photo"
          checked={lighting.matchBackground}
          onChange={(matchBackground) => {
            patch("lighting", { matchBackground });
            const light = matchBackground && bg.kind === "image" ? getStage()?.estimateLightFromBackground() : null;
            if (light) patch("lighting", { ...light, matchBackground });
          }}
        />
        <RowToggle title="Ground the can" hint="Contact shadow and reflection on the backdrop" checked={fx.groundEnabled} onChange={(groundEnabled) => patch("effects", { groundEnabled })} />
      </Group>
    </>
  );
}

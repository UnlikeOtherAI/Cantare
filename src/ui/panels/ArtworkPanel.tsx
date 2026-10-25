import { useState } from "react";
import { demoArtwork } from "../../engine/demoArtwork";
import { rememberArtworkMode } from "../../platform/persistence";
import type { ArtworkFit, ArtworkMode } from "../../engine/settings";
import { useEditor } from "../../state/editor";
import { useUi } from "../../state/ui";
import { Dropzone, Field, Group, Note, Seg, Slider, useFilePicker } from "../controls";
import { Icon } from "../icons";

const RESET = { top: null, bottom: null, fit: "auto" as const };

export function loadArtworkFile(file: File) {
  const { patch, settings } = useEditor.getState();
  if (settings.artwork.url?.startsWith("blob:")) URL.revokeObjectURL(settings.artwork.url);
  patch("artwork", { url: URL.createObjectURL(file), name: file.name, ...RESET });
  useUi.getState().set({ welcome: false });
}

export function loadSampleArtwork() {
  useEditor.getState().patch("artwork", { url: demoArtwork(), name: "Sample: Hopwell IPA", ...RESET });
  useUi.getState().set({ welcome: false });
}

const MODES: { value: ArtworkMode; label: string; help: string }[] = [
  { value: "printed", label: "Printed", help: "Ink on the metal, from the top lip down to the foot and all the way round. Wraparound designs go here. Transparent areas show the body colour." },
  { value: "label", label: "Label", help: "Paper or film on the flat, printable part of the body, with a visible edge." },
  { value: "sticker", label: "Sticker", help: "A die-cut patch with rounded corners on the flat part of the body, sized from your image." }
];

export function ArtworkPanel() {
  const artwork = useEditor((s) => s.settings.artwork);
  const patch = useEditor((s) => s.patch);
  const info = useUi((s) => s.info);
  const setTool = useUi((s) => s.setTool);
  const [menu, setMenu] = useState(false);
  const replace = useFilePicker("image/png,image/jpeg,image/webp", loadArtworkFile);

  const placement = info?.placement;
  const format = info?.format;
  const size = info?.artworkSize;
  const circumference = format ? Math.PI * format.bodyDiameter : 0;
  const widthMm = placement ? placement.wrap * circumference : 0;
  const dpi = size && widthMm ? Math.round(size.width / (widthMm / 25.4)) : 0;
  const mode = MODES.find((m) => m.value === artwork.mode)!;

  return (
    <>
      <Seg<ArtworkMode>
        label="Decoration type"
        options={MODES.map(({ value, label }) => ({ value, label }))}
        value={artwork.mode}
        onChange={(next) => {
          rememberArtworkMode(next);
          patch("artwork", { mode: next, ...RESET });
        }}
      />
      <p className="help">{mode.help}</p>

      {!artwork.url ? (
        <>
          <Dropzone
            title="Drop artwork or tap to choose"
            hint="PNG or JPEG · transparent PNG keeps the metal visible"
            accept="image/png,image/jpeg,image/webp"
            onFile={loadArtworkFile}
          />
          <button className="link-btn" type="button" onClick={loadSampleArtwork} style={{ alignSelf: "flex-start" }}>
            Try the sample label
          </button>
        </>
      ) : (
        <div className="asset">
          <div className="asset__thumb">
            <img src={artwork.url} alt="" />
          </div>
          <div className="asset__text">
            <div className="asset__name">{artwork.name ?? "Artwork"}</div>
            {size && (
              <div className="asset__meta mono">
                {size.width} × {size.height} px{dpi ? ` · ${dpi} dpi` : ""}
              </div>
            )}
            {placement && format && (
              <div className={`asset__fit asset__fit--${placement.fromTemplate ? "template" : "inferred"}`}>
                <Icon name={placement.fromTemplate ? "check" : "info"} />
                <span>
                  {placement.fromTemplate && format.artwork
                    ? `Matches ${format.supplier} ${format.name} template (${format.artwork.width} × ${format.artwork.height} mm)`
                    : `${Math.round(widthMm)} × ${Math.round(placement.top - placement.base)} mm${placement.stretched ? ", stretched round the can" : ""}`}
                </span>
              </div>
            )}
            {dpi > 0 && dpi < 150 && (
              <div className="asset__fit asset__fit--inferred">
                <Icon name="alert" />
                <span>Low resolution: {dpi} dpi at this size</span>
              </div>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <button className="icon-btn" type="button" title="Replace or remove" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Icon name="more" />
            </button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <button type="button" onClick={() => (setMenu(false), replace())}>
                  Replace…
                </button>
                <button type="button" onClick={() => (setMenu(false), patch("artwork", RESET))}>
                  Reset placement
                </button>
                <button type="button" onClick={() => (setMenu(false), patch("artwork", { url: null, name: null }))}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Group title="Placement" hint={artwork.mode === "printed" ? "Lip to foot by default" : "On the flat part"}>
        {placement && (
          <>
            <Slider
              label="Top edge"
              unit="mm"
              min={Math.floor(placement.range.low)}
              max={Math.ceil(placement.range.high)}
              value={Math.round(placement.top)}
              onChange={(top) => patch("artwork", { top, bottom: Math.min(placement.base, top - 4) })}
            />
            <Slider
              label="Bottom edge"
              unit="mm"
              min={Math.floor(placement.range.low)}
              max={Math.ceil(placement.range.high)}
              value={Math.round(placement.base)}
              onChange={(bottom) => patch("artwork", { bottom, top: Math.max(placement.top, bottom + 4) })}
            />
          </>
        )}
        <Slider label="Rotation" unit="°" min={-180} max={180} value={Math.round(artwork.rotation)} onChange={(rotation) => patch("artwork", { rotation })} />
        {artwork.mode !== "sticker" && (
          <Field label="Width" seg>
            <Seg<ArtworkFit>
              size="sm"
              label="Width"
              options={[
                { value: "auto", label: "Auto", title: "Stretch round the can when the image nearly fits, otherwise keep its proportions" },
                { value: "wrap", label: "All round", title: "Stretch the artwork round the whole can" },
                { value: "aspect", label: "Proportional", title: "Keep the image's proportions; a narrow image leaves a gap at the back" }
              ]}
              value={artwork.fit}
              onChange={(fit) => patch("artwork", { fit })}
            />
          </Field>
        )}
      </Group>

      {artwork.mode === "printed" ? (
        <Field label="Ink" seg>
          <Seg
            size="sm"
            label="Ink"
            options={[
              { value: "opaque", label: "Opaque", title: "Solid ink over the metal" },
              { value: "translucent", label: "Metallic", title: "Translucent ink: bare metal shines through" }
            ]}
            value={artwork.ink}
            onChange={(ink) => patch("artwork", { ink })}
          />
        </Field>
      ) : (
        <Field label="Material" seg>
          <Seg
            size="sm"
            label="Label material"
            options={[
              { value: "paper", label: "Paper" },
              { value: "film", label: artwork.mode === "sticker" ? "Vinyl" : "Film" }
            ]}
            value={artwork.labelStock}
            onChange={(labelStock) => patch("artwork", { labelStock })}
          />
        </Field>
      )}

      <Note>
        Drag on the can with this tool to slide the artwork round it or up and down; drag the violet edges to set the top and bottom. The body colour shows around it — change it in{" "}
        <button className="link-btn" type="button" onClick={() => setTool("colour")}>
          Colour
        </button>
        .
      </Note>
    </>
  );
}

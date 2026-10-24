import { useState } from "react";
import { demoArtwork } from "../../engine/demoArtwork";
import { useEditor } from "../../state/editor";
import { useUi } from "../../state/ui";
import { Dropzone, Field, Group, Note, Seg, Slider, useFilePicker } from "../controls";
import { Icon } from "../icons";

export function loadArtworkFile(file: File) {
  const { patch, settings } = useEditor.getState();
  if (settings.artwork.url?.startsWith("blob:")) URL.revokeObjectURL(settings.artwork.url);
  patch("artwork", { url: URL.createObjectURL(file), name: file.name, height: null, offset: 0, wrap: null });
  useUi.getState().set({ welcome: false });
}

export function loadSampleArtwork() {
  useEditor.getState().patch("artwork", { url: demoArtwork(), name: "Sample: Hopwell IPA", height: null, offset: 0, wrap: null });
  useUi.getState().set({ welcome: false });
}

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
  const label = artwork.mode === "label";

  return (
    <>
      <Seg
        label="Decoration type"
        options={[
          { value: "printed", label: "Printed can" },
          { value: "label", label: "Label" }
        ]}
        value={artwork.mode}
        onChange={(mode) => patch("artwork", { mode, height: null, offset: 0 })}
      />
      <p className="help">
        {label
          ? "Paper or film wrapped around the body, with a visible edge."
          : "Ink on the metal from the bottom of the can to the lid. Transparent areas show the body colour and metal."}
      </p>

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
                    : `Size ${artwork.height == null ? "inferred from image" : "set"}: ${Math.round(widthMm)} × ${Math.round(placement.height)} mm`}
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
                <button type="button" onClick={() => (setMenu(false), patch("artwork", { height: null, offset: 0, wrap: null }))}>
                  Re-infer size
                </button>
                <button type="button" onClick={() => (setMenu(false), patch("artwork", { url: null, name: null }))}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {label ? (
        <Group>
          <Field label="Wrap" seg>
            <Seg
              size="sm"
              label="Wrap"
              options={[
                { value: "full", label: "Full" },
                { value: "partial", label: "Partial" }
              ]}
              value={artwork.wrap == null ? "full" : "partial"}
              onChange={(v) => patch("artwork", { wrap: v === "full" ? null : 0.5, height: null })}
            />
          </Field>
          {artwork.wrap != null && (
            <Slider label="Coverage" unit="%" min={10} max={100} value={Math.round(artwork.wrap * 100)} onChange={(v) => patch("artwork", { wrap: v / 100, height: null })} />
          )}
          <Field label="Material" seg>
            <Seg
              size="sm"
              label="Label material"
              options={[
                { value: "paper", label: "Paper" },
                { value: "film", label: "Film" }
              ]}
              value={artwork.labelStock}
              onChange={(labelStock) => patch("artwork", { labelStock })}
            />
          </Field>
        </Group>
      ) : (
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
      )}

      <Group>
        {label && placement && (
          <>
            <Slider label="Height" unit="mm" min={10} max={Math.round(format ? format.height - format.neckHeight : 150)} value={Math.round(placement.height)} onChange={(height) => patch("artwork", { height })} />
            <Slider label="Position" unit="mm" min={-60} max={60} value={Math.round(artwork.offset)} onChange={(offset) => patch("artwork", { offset })} />
          </>
        )}
        <Slider label="Rotation" unit="°" min={-180} max={180} value={Math.round(artwork.rotation)} onChange={(rotation) => patch("artwork", { rotation })} />
      </Group>

      <Note>
        Drag on the can to rotate the artwork{label ? "; drag up or down to move the label, or its violet edges to resize" : ""}. The body colour shows around it — change it in{" "}
        <button className="link-btn" type="button" onClick={() => setTool("colour")}>
          Colour
        </button>
        .
      </Note>
    </>
  );
}

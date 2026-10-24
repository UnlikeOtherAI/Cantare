import { useState } from "react";
import type { ColorPreset, Finish, PartAppearance } from "../../engine/settings";
import { useEditor } from "../../state/editor";
import { ColourPopover, Group, HexField, Seg, Toggle } from "../controls";
import { Icon } from "../icons";

const PRESETS: { value: Exclude<ColorPreset, "custom">; label: string; swatch: string; hex: string }[] = [
  { value: "silver", label: "Classic silver", swatch: "var(--c-can-silver)", hex: "#c9cbcf" },
  { value: "gold", label: "Classic gold", swatch: "var(--c-can-gold)", hex: "#d4a84b" },
  { value: "black", label: "Black", swatch: "var(--c-can-black)", hex: "#16171a" },
  { value: "white", label: "White", swatch: "var(--c-can-white)", hex: "#f2f1ee" }
];

const FINISHES: { value: Finish; label: string }[] = [
  { value: "gloss", label: "Gloss" },
  { value: "satin", label: "Satin" },
  { value: "matte", label: "Matte" },
  { value: "brushed", label: "Brushed" }
];

function PartEditor({ part, which, onChange }: { part: PartAppearance; which: "Body" | "Lid"; onChange(patch: Partial<PartAppearance>): void }) {
  const [open, setOpen] = useState(false);
  const shownHex = part.preset === "custom" ? part.color : PRESETS.find((p) => p.value === part.preset)!.hex;
  return (
    <>
      <div className="swatches" role="radiogroup" aria-label={`${which} colour`}>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={part.preset === p.value}
            className={`swatch${part.preset === p.value ? " is-active" : ""}`}
            style={{ ["--swatch" as string]: p.swatch }}
            aria-label={p.label}
            title={p.label}
            onClick={() => {
              setOpen(false);
              onChange({ preset: p.value });
            }}
          />
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={part.preset === "custom"}
          className={`swatch swatch--custom${part.preset === "custom" ? " is-active" : ""}`}
          aria-label="Custom colour"
          title="Custom"
          onClick={() => {
            setOpen(true);
            onChange({ preset: "custom" });
          }}
        >
          <Icon name="plus" />
        </button>
        <HexField label={`${which} hex colour`} value={shownHex} onChange={(hex) => onChange({ preset: "custom", color: hex })} />
      </div>
      {open && part.preset === "custom" && <ColourPopover value={part.color} onChange={(hex) => onChange({ color: hex })} onDone={() => setOpen(false)} />}
      {part.preset === "custom" && (
        <div className="row-toggle" style={{ paddingBlock: 0 }}>
          <span className="row-toggle__text">
            <span>Metallic</span>
            <span className="group__hint">Tinted aluminium instead of paint</span>
          </span>
          <Toggle label="Metallic" checked={part.metallic} onChange={(metallic) => onChange({ metallic })} />
        </div>
      )}
      <Seg label={`${which} finish`} options={FINISHES} value={part.finish} onChange={(finish) => onChange({ finish })} />
    </>
  );
}

export function ColourPanel() {
  const body = useEditor((s) => s.settings.body);
  const lid = useEditor((s) => s.settings.lid);
  const patch = useEditor((s) => s.patch);
  return (
    <>
      <Group title="Body" hint="Shows wherever artwork doesn't cover">
        <PartEditor which="Body" part={body} onChange={(p) => patch("body", p)} />
      </Group>
      <Group
        title="Lid"
        action={
          <button className="link-btn" type="button" onClick={() => patch("lid", { ...body })}>
            Same as body
          </button>
        }
      >
        <PartEditor which="Lid" part={lid} onChange={(p) => patch("lid", p)} />
      </Group>
    </>
  );
}

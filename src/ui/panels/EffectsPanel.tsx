import type { ReactNode } from "react";
import { GRADE_PRESETS, type EffectSettings, type FocusTarget, type GradePreset } from "../../engine/settings";
import { useEditor } from "../../state/editor";
import { useUi } from "../../state/ui";
import { Field, Seg, Slider, Toggle } from "../controls";
import { Icon } from "../icons";

const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const nearestStop = (f: number) => STOPS.reduce((best, s, i) => (Math.abs(s - f) < Math.abs(STOPS[best] - f) ? i : best), 0);
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

function Row({
  title,
  enabled,
  onToggle,
  value,
  open,
  children
}: {
  title: string;
  enabled: boolean;
  onToggle(on: boolean): void;
  value: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="fx" open={open}>
      <summary className="fx__head">
        <Toggle label={title} checked={enabled} onChange={onToggle} />
        <span className="fx__title">{title}</span>
        <span className="fx__value mono">{enabled ? value : "Off"}</span>
        <Icon name="chev-down" className="fx__chev" />
      </summary>
      <div className="fx__body">{children}</div>
    </details>
  );
}

export function EffectsPanel() {
  const fx = useEditor((s) => s.settings.effects);
  const patch = useEditor((s) => s.patch);
  const pickingFocus = useUi((s) => s.pickingFocus);
  const setUi = useUi((s) => s.set);
  const set = (p: Partial<EffectSettings>) => patch("effects", p);
  const grade = (p: Partial<EffectSettings>) => set({ ...p, grade: "custom", gradeEnabled: true });
  const pct = (v: number) => Math.round(v * 100);

  return (
    <>
      <Row title="Depth of field" enabled={fx.dofEnabled} onToggle={(dofEnabled) => set({ dofEnabled })} value={`f/${fx.aperture}`} open>
        <Slider
          label="Aperture ƒ/"
          min={0}
          max={STOPS.length - 1}
          value={nearestStop(fx.aperture)}
          format={(i) => String(STOPS[Math.round(i)])}
          parse={(t) => nearestStop(parseFloat(t))}
          onChange={(i) => set({ aperture: STOPS[Math.round(i)], dofEnabled: true })}
        />
        <Field label="Focus" seg>
          <Seg<FocusTarget>
            size="sm"
            label="Focus"
            options={[
              { value: "label", label: "Label" },
              { value: "lid", label: "Lid" },
              { value: "point", label: "Tap to focus" }
            ]}
            value={pickingFocus ? "point" : fx.focus}
            onChange={(focus) => {
              if (focus === "point") setUi({ pickingFocus: true });
              else {
                setUi({ pickingFocus: false });
                set({ focus, dofEnabled: true });
              }
            }}
          />
        </Field>
        {pickingFocus && <p className="help">Tap the can where it should be sharpest.</p>}
      </Row>

      <Row title="Bloom" enabled={fx.bloomEnabled} onToggle={(bloomEnabled) => set({ bloomEnabled })} value={String(pct(fx.bloom))}>
        <Slider label="Amount" unit="%" min={0} max={100} value={pct(fx.bloom)} onChange={(v) => set({ bloom: v / 100, bloomEnabled: true })} />
        <Slider label="Threshold" unit="%" min={0} max={100} value={pct(fx.bloomThreshold)} onChange={(v) => set({ bloomThreshold: v / 100, bloomEnabled: true })} />
      </Row>

      <Row title="Vignette" enabled={fx.vignetteEnabled} onToggle={(vignetteEnabled) => set({ vignetteEnabled })} value={String(pct(fx.vignette))}>
        <Slider label="Amount" unit="%" min={0} max={100} value={pct(fx.vignette)} onChange={(v) => set({ vignette: v / 100, vignetteEnabled: true })} />
      </Row>

      <Row title="Grain" enabled={fx.grainEnabled} onToggle={(grainEnabled) => set({ grainEnabled })} value={String(pct(fx.grain))}>
        <Slider label="Amount" unit="%" min={0} max={100} value={pct(fx.grain)} onChange={(v) => set({ grain: v / 100, grainEnabled: true })} />
        <Slider label="Size" unit="%" min={0} max={100} value={pct(fx.grainSize)} onChange={(v) => set({ grainSize: v / 100, grainEnabled: true })} />
      </Row>

      <Row
        title="Colour grade"
        enabled={fx.gradeEnabled}
        onToggle={(gradeEnabled) => set({ gradeEnabled })}
        value={fx.grade === "custom" ? "Custom" : fx.grade[0].toUpperCase() + fx.grade.slice(1)}
        open
      >
        <div className="chips chips--scroll">
          {(Object.keys(GRADE_PRESETS) as Exclude<GradePreset, "custom">[]).map((g) => (
            <button key={g} type="button" className={`chip${fx.grade === g ? " is-active" : ""}`} onClick={() => set({ ...GRADE_PRESETS[g], grade: g, gradeEnabled: true })}>
              {g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        <Slider wide centre label="Exposure" unit="EV" min={-2} max={2} step={0.1} value={fx.exposure} format={(v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))} onChange={(exposure) => grade({ exposure })} />
        <Slider centre label="Contrast" min={-100} max={100} value={pct(fx.contrast)} format={signed} onChange={(v) => grade({ contrast: v / 100 })} />
        <Slider centre label="Saturation" min={-100} max={100} value={pct(fx.saturation)} format={signed} onChange={(v) => grade({ saturation: v / 100 })} />
        <Slider centre temperature label="Warmth" min={-100} max={100} value={pct(fx.warmth)} format={signed} onChange={(v) => grade({ warmth: v / 100 })} />
      </Row>

      <Row
        title="Ground"
        enabled={fx.groundEnabled}
        onToggle={(groundEnabled) => set({ groundEnabled })}
        value={[fx.shadow > 0 && "Shadow", fx.reflection > 0 && "Reflection"].filter(Boolean).join(" · ") || "None"}
      >
        <Slider label="Shadow" unit="%" min={0} max={100} value={pct(fx.shadow)} onChange={(v) => set({ shadow: v / 100, groundEnabled: true })} />
        <Slider label="Shadow softness" unit="%" min={0} max={100} value={pct(fx.shadowSoftness)} onChange={(v) => set({ shadowSoftness: v / 100 })} />
        <Slider label="Reflection" unit="%" min={0} max={100} value={pct(fx.reflection)} onChange={(v) => set({ reflection: v / 100, groundEnabled: true })} />
        <Slider label="Reflection fade" unit="%" min={0} max={100} value={pct(fx.reflectionFade)} onChange={(v) => set({ reflectionFade: v / 100 })} />
      </Row>
    </>
  );
}

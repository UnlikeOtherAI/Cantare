import { useRef } from "react";
import type { EnvironmentPreset, LightingSettings, RimSide } from "../../engine/settings";
import { useEditor } from "../../state/editor";
import { Field, Group, Seg, Slider, Toggle } from "../controls";

const ENVIRONMENTS: { value: EnvironmentPreset; label: string; art: string }[] = [
  { value: "softbox", label: "Softbox", art: "env--softbox" },
  { value: "hard", label: "Hard studio", art: "env--hard" },
  { value: "daylight", label: "Daylight", art: "env--daylight" },
  { value: "golden", label: "Golden hour", art: "env--golden" },
  { value: "bar", label: "Bar", art: "env--bar" },
  { value: "overcast", label: "Overcast", art: "env--overcast" }
];

/**
 * Light direction on a disc seen from above, camera at the bottom: angle around the
 * centre is azimuth (0 = from the camera, 90 = from the right), distance from the edge
 * towards the centre is elevation.
 */
export function lightToDisc(azimuth: number, elevation: number) {
  const d = 1 - elevation / 90;
  const a = (azimuth * Math.PI) / 180;
  return { x: d * Math.sin(a), y: d * Math.cos(a) };
}

export function discToLight(x: number, y: number) {
  const azimuth = Math.round((Math.atan2(x, y) * 180) / Math.PI);
  const elevation = Math.round((1 - Math.min(1, Math.max(0.08, Math.hypot(x, y)))) * 90);
  return { azimuth, elevation };
}

/** Pointer drag that maps a position inside `el` (scaled by rx, ry of its box) to a light. */
export function useLightDrag(onChange: (light: { azimuth: number; elevation: number }) => void, rx: number, ry: number) {
  return (el: HTMLElement, e: React.PointerEvent, capture: HTMLElement = el) => {
    e.preventDefault();
    capture.setPointerCapture(e.pointerId);
    const move = (ev: { clientX: number; clientY: number }) => {
      const b = el.getBoundingClientRect();
      onChange(discToLight((ev.clientX - (b.left + b.width / 2)) / (b.width * rx), (ev.clientY - (b.top + b.height / 2)) / (b.height * ry)));
    };
    move(e);
    const onMove = (ev: PointerEvent) => move(ev);
    capture.addEventListener("pointermove", onMove);
    capture.addEventListener("pointerup", () => capture.removeEventListener("pointermove", onMove), { once: true });
  };
}

function Dome({ lighting, onChange }: { lighting: LightingSettings; onChange(patch: Partial<LightingSettings>): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useLightDrag(onChange, 0.42, 0.42);
  const p = lightToDisc(lighting.azimuth, lighting.elevation);
  return (
    <div
      ref={ref}
      className="dome"
      role="slider"
      tabIndex={0}
      aria-label="Key light direction (top-down)"
      aria-valuetext={`Azimuth ${lighting.azimuth}°, elevation ${lighting.elevation}°`}
      onPointerDown={(e) => drag(ref.current!, e)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") onChange({ azimuth: lighting.azimuth - step });
        else if (e.key === "ArrowRight") onChange({ azimuth: lighting.azimuth + step });
        else if (e.key === "ArrowUp") onChange({ elevation: Math.min(85, lighting.elevation + step) });
        else if (e.key === "ArrowDown") onChange({ elevation: Math.max(0, lighting.elevation - step) });
        else return;
        e.preventDefault();
      }}
    >
      <span className="dome__ring" />
      <span className="dome__cross" />
      <span className="dome__can" />
      <span className="dome__sun" style={{ ["--sx" as string]: `${50 + 42 * p.x}%`, ["--sy" as string]: `${50 + 42 * p.y}%` }} />
    </div>
  );
}

export function LightPanel() {
  const lighting = useEditor((s) => s.settings.lighting);
  const patch = useEditor((s) => s.patch);
  const set = (p: Partial<LightingSettings>) => patch("lighting", p);
  const wrapAz = (az: number) => ((((az + 180) % 360) + 360) % 360) - 180;
  return (
    <>
      <Group title="Key light" hint="Drag the sun on the stage or here">
        <div className="dome-row">
          <Dome lighting={lighting} onChange={(p) => set({ ...p, azimuth: wrapAz(p.azimuth ?? lighting.azimuth) })} />
          <div className="dome-readout">
            <div className="readout">
              <span className="readout__label">Azimuth</span>
              <span className="readout__value mono">{lighting.azimuth}°</span>
            </div>
            <div className="readout">
              <span className="readout__label">Elevation</span>
              <span className="readout__value mono">{lighting.elevation}°</span>
            </div>
            <div className="readout">
              <span className="readout__label">Side</span>
              <span className="readout__value">{Math.abs(lighting.azimuth) < 25 ? "Front" : Math.abs(lighting.azimuth) > 135 ? "Back" : lighting.azimuth < 0 ? "Left" : "Right"}</span>
            </div>
          </div>
        </div>
        <Slider label="Intensity" unit="%" min={0} max={200} value={Math.round(lighting.intensity * 100)} onChange={(v) => set({ intensity: v / 100 })} />
        <Slider label="Softness" unit="%" min={0} max={100} value={Math.round(lighting.softness * 100)} onChange={(v) => set({ softness: v / 100 })} />
        <Slider label="Temperature" unit="K" min={2700} max={8000} step={100} temperature value={lighting.temperature} onChange={(temperature) => set({ temperature })} />
      </Group>

      <Group title="Rim light" action={<Toggle label="Rim light" checked={lighting.rimEnabled} onChange={(rimEnabled) => set({ rimEnabled })} />}>
        <Slider label="Intensity" unit="%" min={0} max={200} value={Math.round(lighting.rim * 100)} onChange={(v) => set({ rim: v / 100, rimEnabled: true })} />
        <Field label="Side" seg>
          <Seg<RimSide>
            size="sm"
            label="Rim side"
            options={[
              { value: "opposite", label: "Opposite" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" }
            ]}
            value={lighting.rimSide}
            onChange={(rimSide) => set({ rimSide, rimEnabled: true })}
          />
        </Field>
      </Group>

      <Group title="Environment" hint="Reflections">
        <div className="tiles tiles--3" role="radiogroup" aria-label="Environment">
          {ENVIRONMENTS.map((env) => (
            <button
              key={env.value}
              type="button"
              role="radio"
              aria-checked={lighting.environment === env.value}
              className={`tile${lighting.environment === env.value ? " is-active" : ""}`}
              onClick={() => set({ environment: env.value })}
            >
              <span className={`tile__art env ${env.art}`} />
              <span className="tile__label">{env.label}</span>
            </button>
          ))}
        </div>
        <Slider label="Rotation" unit="°" min={0} max={360} value={lighting.envRotation} onChange={(envRotation) => set({ envRotation })} />
      </Group>
    </>
  );
}

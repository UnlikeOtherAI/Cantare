import { useRef } from "react";
import type { CameraPreset } from "../../engine/settings";
import { useEditor } from "../../state/editor";
import { useUi } from "../../state/ui";
import { Group, Slider, Toggle } from "../controls";
import { Icon, type IconName } from "../icons";
import { getStage } from "../Viewport";

export const ANGLES: { value: CameraPreset; label: string; icon: IconName; key: string }[] = [
  { value: "front", label: "Front", icon: "ang-front", key: "f" },
  { value: "three-quarter", label: "¾", icon: "ang-three", key: "q" },
  { value: "top", label: "Lid", icon: "ang-lid", key: "l" },
  { value: "hero", label: "Hero", icon: "ang-hero", key: "h" }
];

export function goToAngle(angle: CameraPreset) {
  getStage()?.setCameraPreset(angle);
  useUi.getState().set({ angle });
}

function Dial({ value, onChange }: { value: number; onChange(v: number): void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="dial"
      role="slider"
      tabIndex={0}
      aria-label="Spin can"
      aria-valuetext={`${value}°`}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((value - step + 360) % 360);
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((value + step) % 360);
      }}
      onPointerDown={(e) => {
        const el = ref.current!;
        el.setPointerCapture(e.pointerId);
        const move = (ev: { clientX: number; clientY: number }) => {
          const b = el.getBoundingClientRect();
          let a = (Math.atan2(ev.clientX - (b.left + b.width / 2), -(ev.clientY - (b.top + b.height / 2))) * 180) / Math.PI;
          if (a < 0) a += 360;
          onChange(Math.round(a));
        };
        move(e);
        const onMove = (ev: PointerEvent) => move(ev);
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", () => el.removeEventListener("pointermove", onMove), { once: true });
      }}
    >
      <span className="dial__tick" />
      <span className="dial__needle" style={{ ["--rot" as string]: `${value}deg` }} />
    </div>
  );
}

export function CameraPanel() {
  const spin = useEditor((s) => s.settings.spin);
  const focalLength = useEditor((s) => s.settings.focalLength);
  const set = useEditor((s) => s.set);
  const { angle, turntable, view } = useUi();
  const setUi = useUi((s) => s.set);
  return (
    <>
      <Group title="Quick angles" hint="Drag the stage to orbit">
        <div className="tiles tiles--4" role="radiogroup" aria-label="Quick angles">
          {ANGLES.map((a) => (
            <button key={a.value} type="button" role="radio" aria-label={a.label === "¾" ? "Three-quarter" : a.label} aria-checked={angle === a.value} className={`tile${angle === a.value ? " is-active" : ""}`} onClick={() => goToAngle(a.value)}>
              <Icon name={a.icon} className="tile__icon" />
              <span className="tile__label">{a.label}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group
        title="Can spin"
        action={
          <Toggle
            label="Turntable"
            text="Turntable"
            checked={turntable}
            onChange={(on) => {
              setUi({ turntable: on });
              getStage()?.setTurntable(on);
            }}
          />
        }
      >
        <div className="dial-row">
          <Dial value={spin} onChange={(v) => set("spin", v)} />
          <div className="slider slider--stacked">
            <div className="slider__row">
              <label className="slider__label" htmlFor="c-spin">
                Spin
              </label>
              <div className="value">
                <input className="value__input mono" value={spin} readOnly aria-label="Spin angle" />
                <span className="value__unit">°</span>
              </div>
            </div>
            <input
              className="slider__input"
              id="c-spin"
              type="range"
              min={0}
              max={360}
              value={spin}
              style={{ ["--p" as string]: `${(spin / 360) * 100}%` }}
              onChange={(e) => set("spin", Number(e.target.value))}
            />
            <p className="help">Rotates the can, not the camera. Artwork, lid tab and droplets turn with it.</p>
          </div>
        </div>
      </Group>

      <Group title="Lens">
        <Slider label="Focal length" unit="mm" min={24} max={135} value={focalLength} onChange={(v) => set("focalLength", v)} />
        <Slider
          label="Height"
          unit="°"
          min={-5}
          max={85}
          value={view.elevation}
          onChange={(v) => {
            getStage()?.setCameraElevation(v);
            setUi({ angle: null });
          }}
        />
      </Group>

      <div className="row-actions">
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => {
            set("focalLength", 70);
            set("spin", 0);
            goToAngle("three-quarter");
          }}
        >
          <Icon name="reset" className="btn__icon" />
          Reset camera
        </button>
      </div>
    </>
  );
}

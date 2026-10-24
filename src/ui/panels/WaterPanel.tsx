import type { WaterSettings, WaterTool } from "../../engine/settings";
import { useEditor } from "../../state/editor";
import { Group, Note, Seg, Slider } from "../controls";
import { Icon } from "../icons";
import { getStage } from "../Viewport";

const PRESETS: { label: string; water: Pick<WaterSettings, "density" | "size" | "runs" | "haze"> }[] = [
  { label: "Dry", water: { density: 0, size: 0.4, runs: 0.3, haze: 0 } },
  { label: "Chilled", water: { density: 0.3, size: 0.35, runs: 0.2, haze: 0.15 } },
  { label: "Ice cold", water: { density: 0.45, size: 0.3, runs: 0.25, haze: 0.55 } },
  { label: "Poured over", water: { density: 0.6, size: 0.7, runs: 0.8, haze: 0 } }
];

const HINTS: Record<WaterTool, string> = {
  none: "Drag the stage to turn the can. Pick Brush, Spray or Erase to work on it.",
  brush: "Brush: paint droplets where you drag. Two fingers still orbit.",
  spray: "Spray: hold still to soak one spot; heavy drops run down. Two fingers still orbit.",
  erase: "Erase: wipe water and condensation off. Two fingers still orbit."
};

export function WaterPanel() {
  const water = useEditor((s) => s.settings.water);
  const patch = useEditor((s) => s.patch);
  const set = (p: Partial<WaterSettings>) => patch("water", p);
  const active = PRESETS.find((p) => (Object.keys(p.water) as (keyof typeof p.water)[]).every((k) => Math.abs(p.water[k] - water[k]) < 0.005));
  return (
    <>
      <div className="chips" role="radiogroup" aria-label="Presets">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className={`chip${active === p ? " is-active" : ""}`} onClick={() => set({ ...p.water, seed: water.seed + 1 })}>
            {p.label}
          </button>
        ))}
      </div>

      <Group title="Droplets" action={
        <button className="link-btn" type="button" onClick={() => set({ seed: water.seed + 1 })} title="Scatter the drops differently">
          Reshuffle
        </button>
      }>
        <Slider label="Density" unit="%" min={0} max={100} value={Math.round(water.density * 100)} onChange={(v) => set({ density: v / 100 })} />
        <Slider label="Size" unit="%" min={0} max={100} value={Math.round(water.size * 100)} onChange={(v) => set({ size: v / 100 })} />
        <Slider label="Runs & drips" unit="%" min={0} max={100} value={Math.round(water.runs * 100)} onChange={(v) => set({ runs: v / 100 })} />
        <Slider label="Haze" unit="%" min={0} max={100} value={Math.round(water.haze * 100)} onChange={(v) => set({ haze: v / 100 })} />
      </Group>

      <Group title="Paint by hand" hint="On the can">
        <Seg<WaterTool>
          label="Water tool"
          variant="icons"
          options={[
            { value: "none", label: "Turn", icon: "spin" },
            { value: "brush", label: "Brush", icon: "brush" },
            { value: "spray", label: "Spray", icon: "spray" },
            { value: "erase", label: "Erase", icon: "eraser" }
          ]}
          value={water.tool}
          onChange={(tool) => patch("water", { tool }, { history: false })}
        />
        <Slider label="Brush size" unit="mm" min={4} max={80} value={water.brush} onChange={(brush) => patch("water", { brush }, { history: false })} />
        <Slider label="Flow" unit="%" min={0} max={100} value={Math.round(water.flow * 100)} onChange={(v) => patch("water", { flow: v / 100 }, { history: false })} />
        <Note>{HINTS[water.tool]}</Note>
      </Group>

      <div className="row-actions">
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => {
            set({ density: 0, haze: 0 });
            getStage()?.clearWater();
          }}
        >
          <Icon name="trash" className="btn__icon" />
          Clear all water
        </button>
      </div>
    </>
  );
}

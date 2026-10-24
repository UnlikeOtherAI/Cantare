// What the photoreal render is doing right now, so a long render never looks stuck,
// and what this device managed last time, so people know what to expect.

import { useEffect, useState } from "react";
import { Icon } from "./icons";

export type RenderStep = "scene" | "prepare" | "trace" | "finish";

export interface RenderState {
  step: RenderStep;
  startedAt: number;
  gpu: string | null;
  /** When tracing started, for the pass rate. */
  traceStartedAt: number | null;
  done: number;
  total: number;
}

interface DeviceStats {
  prepMs: number;
  passesPerSecond: number;
}

const STATS_KEY = "cantare.renderStats";
const LAST_GPU_KEY = "cantare.lastGpu";

function readStats(): Record<string, DeviceStats> {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** This device's last photoreal timings, if it has rendered before. */
export function lastDeviceStats(): (DeviceStats & { gpu: string }) | null {
  try {
    const gpu = localStorage.getItem(LAST_GPU_KEY);
    const stats = gpu ? readStats()[gpu] : null;
    return gpu && stats ? { gpu, ...stats } : null;
  } catch {
    return null;
  }
}

export function rememberDeviceStats(gpu: string, stats: Partial<DeviceStats>) {
  try {
    const all = readStats();
    all[gpu] = { prepMs: stats.prepMs ?? all[gpu]?.prepMs ?? 0, passesPerSecond: stats.passesPerSecond ?? all[gpu]?.passesPerSecond ?? 0 };
    localStorage.setItem(STATS_KEY, JSON.stringify(all));
    localStorage.setItem(LAST_GPU_KEY, gpu);
  } catch {
    // Estimates are a convenience only.
  }
}

export function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** One line for the export settings: what a photoreal render will roughly take here. */
export function renderEstimate(passes: number, pixels: number): string {
  const last = lastDeviceStats();
  if (!last || !last.passesPerSecond) {
    return "Time depends on your device's graphics: seconds on a strong graphics card, a minute or more on laptops and phones. The first render on a device takes longest.";
  }
  // Pass rate scales roughly with pixel count; stats are for the last render's size.
  const traceMs = (passes / last.passesPerSecond) * 1000 * Math.max(0.5, pixels / (2048 * 2560));
  return `On ${last.gpu}: about ${duration(last.prepMs + traceMs)}, based on your last render here.`;
}

const STEPS: { id: RenderStep; label: string }[] = [
  { id: "scene", label: "Setting up the scene" },
  { id: "prepare", label: "Starting the photoreal renderer" },
  { id: "trace", label: "Tracing light" },
  { id: "finish", label: "Finishing and saving" }
];

export function RenderProgress({ state, onCancel }: { state: RenderState; onCancel(): void }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const order = STEPS.findIndex((s) => s.id === state.step);
  const tracing = state.step === "trace";
  const rate = state.traceStartedAt && state.done > 0 ? state.done / ((now - state.traceStartedAt) / 1000) : 0;
  const left = rate ? ((state.total - state.done) / rate) * 1000 : null;
  const last = lastDeviceStats();
  const percent = tracing ? Math.round((state.done / state.total) * 100) : state.step === "finish" ? 100 : 0;

  return (
    <div className="progress progress--lg render-progress" role="status" aria-live="polite">
      <div className="progress__row">
        <span>{STEPS[order].label}…</span>
        <span className="mono" title="Time since you started">
          {clock(now - state.startedAt)}
        </span>
      </div>
      <div className={`progress__bar${tracing || state.step === "finish" ? "" : " progress__bar--busy"}`}>
        <span style={tracing || state.step === "finish" ? { width: `${percent}%` } : undefined} />
      </div>
      <ol className="render-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i < order ? "is-done" : i === order ? "is-active" : ""}>
            <span className="render-steps__mark">{i < order ? <Icon name="check" /> : i === order ? <span className="spinner" /> : null}</span>
            <span>
              {s.label}
              {s.id === "prepare" && i === order && (
                <span className="render-steps__hint">
                  {last?.prepMs ? `About ${duration(last.prepMs)} on this device.` : "The first time on a device this can take a minute or two while the graphics driver builds the renderer."}
                </span>
              )}
              {s.id === "trace" && i === order && (
                <span className="render-steps__hint mono">
                  {state.done} of {state.total} passes{left != null && state.done > 2 ? ` · about ${duration(left)} left` : ""}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="progress__row progress__row--sub">
        <span>{state.gpu ? `Rendering on ${state.gpu}. You can keep working while it runs.` : "Rendering on this device. You can keep working while it runs."}</span>
        <button className="link-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

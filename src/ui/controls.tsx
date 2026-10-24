import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
  /** Value shown in the field; defaults to the rounded value. */
  format?(value: number): string;
  /** Parse a typed value back; defaults to parseFloat. */
  parse?(text: string): number;
  centre?: boolean;
  wide?: boolean;
  temperature?: boolean;
  stacked?: ReactNode;
}

export function Slider({ label, value, min, max, step = 1, unit, onChange, format, parse, centre, wide, temperature }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : String(Math.round(value / step) * step).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const [text, setText] = useState(shown);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(shown);
  }, [shown]);
  const commitText = () => {
    editing.current = false;
    const parsed = parse ? parse(text) : parseFloat(text.replace(/[^\d.+-]/g, ""));
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
    else setText(shown);
  };
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className={`slider${wide ? " slider--wide" : ""}${temperature ? " slider--temp" : ""}`}>
      <label className="slider__label" htmlFor={id}>
        {label}
      </label>
      <input
        className={`slider__input${centre ? " slider__input--centre" : ""}`}
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--p": `${p}%` } as CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="value">
        <input
          className="value__input mono"
          value={text}
          aria-label={label}
          inputMode="decimal"
          onFocus={() => (editing.current = true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        {unit && <span className="value__unit">{unit}</span>}
      </div>
    </div>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  title?: string;
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  size,
  variant,
  label
}: {
  options: SegOption<T>[];
  value: T;
  onChange(value: T): void;
  size?: "sm";
  variant?: "scroll" | "icons";
  label: string;
}) {
  return (
    <div className={`seg${size ? " seg--sm" : ""}${variant ? ` seg--${variant}` : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={`seg__item${o.value === value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} />}
          {variant === "icons" ? <span>{o.label}</span> : o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, seg }: { label: string; children: ReactNode; seg?: boolean }) {
  return (
    <div className={`field${seg ? " field--seg" : ""}`}>
      <span className="field__label">{label}</span>
      {children}
    </div>
  );
}

export function Toggle({ checked, onChange, label, text }: { checked: boolean; onChange(value: boolean): void; label: string; text?: string }) {
  return (
    <label className="toggle" onClick={(e) => e.stopPropagation()}>
      {text && <span className="toggle__text">{text}</span>}
      <input type="checkbox" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function RowToggle({ title, hint, checked, onChange }: { title: string; hint?: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <label className="row-toggle">
      <span className="row-toggle__text">
        <span>{title}</span>
        {hint && <span className="group__hint">{hint}</span>}
      </span>
      <span className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  );
}

export function Group({ title, hint, action, children }: { title?: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="group">
      {(title || hint || action) && (
        <div className="group__head">
          {title && <h3 className="group__title">{title}</h3>}
          {hint && <span className="group__hint">{hint}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="help help--note">
      <Icon name="info" />
      <span>{children}</span>
    </p>
  );
}

export function PanelHead({ title, onCollapse }: { title: string; onCollapse(): void }) {
  return (
    <header className="panel__head">
      <h2 className="panel__title">{title}</h2>
      <button className="icon-btn panel__collapse" type="button" title="Hide panel" onClick={onCollapse}>
        <Icon name="chev-right" />
      </button>
    </header>
  );
}

// ---------------------------------------------------------------- colour

export function normaliseHex(text: string): string | null {
  const t = text.trim().replace(/^#/, "");
  const full = t.length === 3 ? t.split("").map((c) => c + c).join("") : t;
  return /^[0-9a-f]{6}$/i.test(full) ? `#${full.toLowerCase()}` : null;
}

export function HexField({ value, onChange, label, wide }: { value: string; onChange(hex: string): void; label: string; wide?: boolean }) {
  const [text, setText] = useState(value.replace("#", "").toUpperCase());
  useEffect(() => setText(value.replace("#", "").toUpperCase()), [value]);
  const commit = (raw: string) => {
    const hex = normaliseHex(raw);
    if (hex) onChange(hex);
  };
  return (
    <div className={`hex${wide ? " hex--wide" : ""}`}>
      <span className="hex__hash">#</span>
      <input
        className="hex__input mono"
        value={text}
        maxLength={7}
        aria-label={label}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value.replace("#", "");
          setText(v.toUpperCase());
          if (normaliseHex(v)) commit(v);
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (normaliseHex(pasted)) {
            e.preventDefault();
            commit(pasted);
          }
        }}
        onBlur={() => setText(value.replace("#", "").toUpperCase())}
      />
    </div>
  );
}

function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const RECENT_KEY = "cantare.recentColours";

function recentColours(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function ColourPopover({ value, onChange, onDone }: { value: string; onChange(hex: string): void; onDone(): void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [recent] = useState(recentColours);
  const update = (next: [number, number, number]) => {
    setHsv(next);
    onChange(hsvToHex(...next));
  };
  const drag = (el: HTMLElement, apply: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const b = el.getBoundingClientRect();
      apply(clamp((ev.clientX - b.left) / b.width, 0, 1), clamp((ev.clientY - b.top) / b.height, 0, 1));
    };
    move(e);
    const onMove = (ev: PointerEvent) => move(ev);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", () => el.removeEventListener("pointermove", onMove), { once: true });
  };
  const area = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);
  const done = () => {
    try {
      const list = [value, ...recentColours().filter((c) => c !== value)].slice(0, 4);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // Recent colours are a convenience only.
    }
    onDone();
  };
  return (
    <div className="popover colour-pop">
      <div
        ref={area}
        className="colour-pop__area"
        style={{ background: `linear-gradient(180deg, transparent, #000), linear-gradient(90deg, #fff, ${hsvToHex(hsv[0], 1, 1)})` }}
        onPointerDown={(e) => drag(area.current!, (x, y) => update([hsv[0], x, 1 - y]))(e)}
      >
        <span className="colour-pop__dot" style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%` }} />
      </div>
      <div ref={hue} className="colour-pop__hue" onPointerDown={(e) => drag(hue.current!, (x) => update([x * 360, hsv[1], hsv[2]]))(e)}>
        <span className="colour-pop__dot" style={{ left: `${(hsv[0] / 360) * 100}%` }} />
      </div>
      <div className="colour-pop__row">
        <HexField
          wide
          label="Hex"
          value={value}
          onChange={(hex) => {
            setHsv(hexToHsv(hex));
            onChange(hex);
          }}
        />
        <button className="btn btn--sm" type="button" onClick={done}>
          Done
        </button>
      </div>
      {recent.length > 0 && (
        <div className="colour-pop__recent">
          <span className="group__hint">Recent</span>
          {recent.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Use ${c}`}
              style={{ width: 20, height: 20, borderRadius: 4, background: c }}
              onClick={() => {
                setHsv(hexToHsv(c));
                onChange(c);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- file input

export function useFilePicker(accept: string, onFile: (file: File) => void) {
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = accept;
    el.addEventListener("change", () => {
      const file = el.files?.[0];
      if (file) onFile(file);
      el.value = "";
    });
    input.current = el;
  }, [accept, onFile]);
  return () => input.current?.click();
}

export function Dropzone({ title, hint, accept, onFile }: { title: string; hint: string; accept: string; onFile(file: File): void }) {
  const [over, setOver] = useState(false);
  const pick = useFilePicker(accept, onFile);
  return (
    <button
      className={`dropzone${over ? " is-over" : ""}`}
      type="button"
      onClick={pick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <Icon name="upload" className="dropzone__icon" />
      <span className="dropzone__title">{title}</span>
      <span className="dropzone__hint">{hint}</span>
    </button>
  );
}

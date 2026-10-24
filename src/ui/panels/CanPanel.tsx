import { useMemo, useState } from "react";
import { ENDS, FAMILY_LABELS, FORMATS, getFormat, type CanFormat } from "../../engine/formats";
import { useEditor } from "../../state/editor";
import { Icon } from "../icons";
import { Seg } from "../controls";

type Tab = "all" | "standard" | "sleek" | "slim" | "us" | "large";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "standard", label: "Standard 66" },
  { value: "sleek", label: "Sleek 58" },
  { value: "slim", label: "Slim 53" },
  { value: "us", label: "US" },
  { value: "large", label: "Large" }
];

const GROUP_LABELS: Record<Exclude<Tab, "all">, string> = {
  standard: "Standard · Ø 66 mm",
  sleek: "Sleek · Ø 58 mm",
  slim: "Slim · Ø 53 mm",
  us: "US",
  large: "Large"
};

function tabOf(f: CanFormat): Exclude<Tab, "all"> {
  if (f.family === "mega" || f.family === "crowler") return "large";
  if (f.region === "US") return "us";
  if (f.family === "longfit") return "standard";
  return f.family as "standard" | "sleek" | "slim";
}

function badge(f: CanFormat): string | null {
  if (f.family === "longfit") return `Long Fit · Ø${f.bodyDiameter}`;
  if (f.capacityAlt === "1 imperial pint") return "UK pint";
  if (f.capacityAlt && f.region === "US") return `${f.capacityMl} ml`;
  if (f.capacityAlt) return f.capacityAlt.replace(" fl oz", " oz");
  return f.artwork ? "template" : null;
}

/** Other formats that are the same can with a different end (330 ml sleek: 202 or 200). */
function variants(f: CanFormat) {
  return FORMATS.filter((o) => o.family === f.family && o.region === f.region && o.capacityMl === f.capacityMl && o.height === f.height && o.bodyDiameter === f.bodyDiameter);
}

export function formatTitle(f: CanFormat) {
  return `${f.name} · ${FAMILY_LABELS[f.family]}`;
}

function Silhouette({ format, className }: { format: CanFormat; className?: string }) {
  // Scaled to the Crowler's envelope so relative heights read true.
  return (
    <span className={className ?? "format-row__sil"}>
      <i style={{ ["--w" as string]: `${Math.round((format.bodyDiameter / 84) * 26)}px`, ["--h" as string]: `${Math.round((format.height / 194) * 36)}px` }} />
    </span>
  );
}

export function CanPanel() {
  const formatId = useEditor((s) => s.settings.formatId);
  const set = useEditor((s) => s.set);
  const current = getFormat(formatId);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const sameCan = variants(current);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = new Map<Exclude<Tab, "all">, CanFormat[]>();
    for (const f of FORMATS) {
      const t = tabOf(f);
      if (tab !== "all" && t !== tab) continue;
      const hay = `${f.name} ${f.capacityMl} ml ${f.capacityAlt ?? ""} ${f.family} ${f.supplier} ${f.bodyDiameter} ${Math.round(f.height)} ${f.region}`.toLowerCase();
      if (q && !q.split(/\s+/).every((word) => hay.includes(word))) continue;
      out.set(t, [...(out.get(t) ?? []), f]);
    }
    return out;
  }, [tab, query]);

  return (
    <>
      <div className="format-current">
        <span className="format-current__thumb" style={{ display: "grid", placeItems: "end center" }}>
          <i
            style={{
              display: "block",
              width: `${(current.bodyDiameter / 84) * 40}px`,
              height: `${(current.height / 194) * 72}px`,
              borderRadius: "3px 3px 2px 2px",
              background: "linear-gradient(90deg, #6c6f74, #e5e7ea 40%, #a2a5ab 70%, #55585d)"
            }}
          />
        </span>
        <div className="format-current__text">
          <div className="format-current__name">{formatTitle(current)}</div>
          <div className="format-current__dims mono">
            Ø {current.bodyDiameter} × {current.height} mm
          </div>
          <div className="format-current__sub">
            {current.supplier} · {current.end} end ·{" "}
            {current.artwork ? `template ${current.artwork.width}×${current.artwork.height} mm` : "no template, size inferred"}
          </div>
        </div>
      </div>

      {sameCan.length > 1 && (
        <div className="field">
          <label className="field__label" htmlFor="lid-variant">
            Lid
          </label>
          <div className="select">
            <select id="lid-variant" value={current.id} onChange={(e) => set("formatId", e.target.value)}>
              {sameCan.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.end} CDL ({ENDS[f.end].plugDiameter.toFixed(1)} mm plug)
                </option>
              ))}
            </select>
            <Icon name="chev-down" className="select__chev" />
          </div>
        </div>
      )}

      <div className="search">
        <Icon name="search" className="search__icon" />
        <input type="search" placeholder="Search formats: 440, 16 oz, sleek…" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <Seg<Tab> label="Can family" options={TAB_OPTIONS} value={tab} onChange={setTab} variant="scroll" />

      <div className="format-list" role="listbox" aria-label="Formats">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group} style={{ display: "contents" }}>
            {tab === "all" && <div className="format-list__family">{GROUP_LABELS[group]}</div>}
            {items.map((f) => {
              const b = badge(f);
              return (
                <button
                  key={f.id}
                  type="button"
                  role="option"
                  aria-selected={f.id === current.id}
                  className={`format-row${f.id === current.id ? " is-active" : ""}`}
                  onClick={() => set("formatId", f.id)}
                >
                  <Silhouette format={f} />
                  <span>
                    <span className="format-row__name">{f.name}</span>
                    {b && <span className="format-row__badge">{b}</span>}
                    <br />
                    <span className="format-row__sub">
                      {f.supplier} · {f.end} end
                    </span>
                  </span>
                  <span className="format-row__dims mono">
                    Ø {f.bodyDiameter} × {f.height}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {groups.size === 0 && (
          <p className="help" style={{ padding: "12px 6px" }}>
            No format matches “{query}”. Try a capacity (440) or a family (sleek).
          </p>
        )}
      </div>
      <p className="help">Dimensions are published supplier values; see the can reference for sources. End size changes the lid and neck.</p>
    </>
  );
}

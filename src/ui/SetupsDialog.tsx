import { useEffect, useRef, useState } from "react";
import { getFormat } from "../engine/formats";
import { applySetup, deleteSetup, listSetups, renameSetup, restoreSetup, saveSetup, undoSceneChange, type Setup } from "../platform/persistence";
import { useUi } from "../state/ui";
import { Icon } from "./icons";
import { formatTitle } from "./panels/CanPanel";
import { getStage } from "./Viewport";

const THUMB = { width: 320, height: 400 };

const dateOf = (time: number) => {
  const date = new Date(time);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
const metaOf = (setup: Setup) => `${formatTitle(getFormat(setup.settings.formatId))} · ${dateOf(setup.updatedAt)}`;

/** A small render of the current scene for the setup card. Null if the stage can't make one. */
async function renderThumbnail(): Promise<Blob | null> {
  const stage = getStage();
  if (!stage) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  return Promise.race([stage.exportImage({ ...THUMB, type: "image/jpeg", quality: 0.82 }).catch(() => null), timeout]);
}

/** Object URLs for setup thumbnails, revoked when the dialog closes. */
function useThumbs() {
  const urls = useRef(new Map<Blob, string>());
  useEffect(() => {
    const map = urls.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);
  return (blob: Blob | null) => {
    if (!blob) return null;
    let url = urls.current.get(blob);
    if (!url) {
      url = URL.createObjectURL(blob);
      urls.current.set(blob, url);
    }
    return url;
  };
}

function Thumb({ src, name }: { src: string | null; name: string }) {
  return src ? <img src={src} alt="" /> : <span className="setup__placeholder" aria-label={name}><Icon name="can" /></span>;
}

export function SetupsDialog({ mode, onClose }: { mode: "save" | "list"; onClose(): void }) {
  const setUi = useUi((s) => s.set);
  const [view, setView] = useState(mode);
  const [setups, setSetups] = useState<Setup[] | null>(null);
  const [open, setOpen] = useState<Setup | null>(null);
  const [removed, setRemoved] = useState<Setup | null>(null);
  const thumb = useThumbs();

  const refresh = () =>
    listSetups()
      .then(setSetups)
      .catch(() => setSetups([]));

  useEffect(() => {
    void refresh();
  }, []);

  const apply = async (setup: Setup) => {
    const snapshot = await applySetup(setup);
    onClose();
    useUi.getState().showToast({ text: `Applied “${setup.name}”`, tone: "ok", action: { label: "Undo", run: () => undoSceneChange(snapshot) } });
  };

  const remove = async (setup: Setup) => {
    await deleteSetup(setup).catch(() => undefined);
    setOpen(null);
    setRemoved(setup);
    await refresh();
  };

  const undoRemove = async () => {
    if (!removed) return;
    await restoreSetup(removed).catch(() => undefined);
    setRemoved(null);
    await refresh();
  };

  const rename = async (setup: Setup, name: string) => {
    if (!name.trim() || name.trim() === setup.name) return;
    const next = await renameSetup(setup, name).catch(() => setup);
    setOpen(next);
    setSetups((list) => list?.map((s) => (s.id === next.id ? next : s)) ?? null);
  };

  const title = view === "save" ? "Save setup" : open ? open.name : "Setups";

  return (
    <div className="dialog-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog--setups" role="dialog" aria-modal="true" aria-labelledby="setups-title">
        <header className="dialog__head">
          {view === "list" && open && (
            <button className="icon-btn" type="button" aria-label="Back" onClick={() => setOpen(null)}>
              <Icon name="chev-left" />
            </button>
          )}
          <h2 className="dialog__title" id="setups-title">
            {title} {view === "list" && !open && <span className="dialog__count">{setups?.length || ""}</span>}
          </h2>
          <span className="group__hint">Saved on this device</span>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        {view === "save" ? (
          <SaveSetup
            setups={setups}
            onCancel={mode === "save" ? onClose : () => setView("list")}
            onSaved={(setup) => {
              onClose();
              useUi.getState().showToast({ text: `Saved “${setup.name}”`, tone: "ok", action: { label: "Setups", run: () => setUi({ dialog: "setups" }) } });
            }}
          />
        ) : open ? (
          <div className="dialog__body viewer setup-view">
            <div className="setup-view__art">
              <Thumb src={thumb(open.thumbnail)} name={open.name} />
            </div>
            <label className="field">
              <span className="field__label">Name</span>
              <input
                key={open.id}
                className="text-input"
                defaultValue={open.name}
                maxLength={120}
                aria-label="Setup name"
                onBlur={(e) => void rename(open, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </label>
            <span className="setup-view__meta mono">{metaOf(open)}</span>
            <div className="viewer__actions">
              <button className="btn btn--primary" type="button" onClick={() => void apply(open)}>
                <Icon name="check" className="btn__icon" />
                Apply setup
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => void remove(open)}>
                <Icon name="trash" className="btn__icon" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog__body">
            <div className="setups__bar">
              {removed ? (
                <span className="setups__removed">
                  Deleted “{removed.name}”
                  <button className="link-btn" type="button" onClick={() => void undoRemove()}>
                    Undo
                  </button>
                </span>
              ) : (
                <span className="help">Apply one to bring back every setting and image.</span>
              )}
              <button className="btn btn--sm" type="button" onClick={() => setView("save")}>
                <Icon name="plus" className="btn__icon" />
                Save current
              </button>
            </div>
            <div className="gallery setups">
              {setups?.map((setup) => (
                <button key={setup.id} className="render" type="button" style={{ ["--ar" as string]: `${THUMB.width}/${THUMB.height}` }} onClick={() => setOpen(setup)}>
                  <span className="render__art">
                    <Thumb src={thumb(setup.thumbnail)} name={setup.name} />
                  </span>
                  <span className="render__meta">
                    <span className="setup__name">{setup.name}</span>
                    <span className="mono">{metaOf(setup)}</span>
                  </span>
                </button>
              ))}
              {setups?.length === 0 && (
                <div className="gallery__empty">
                  <p className="gallery__empty-title">No setups yet</p>
                  <p className="help">Save the current scene to reuse it later. Setups stay on this device.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveSetup({ setups, onCancel, onSaved }: { setups: Setup[] | null; onCancel(): void; onSaved(setup: Setup): void }) {
  const sceneName = useUi((s) => s.sceneName);
  const [name, setName] = useState(sceneName);
  const [preview, setPreview] = useState<{ blob: Blob | null; url: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const existing = setups?.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void renderThumbnail().then((blob) => {
      if (!live) return;
      url = blob ? URL.createObjectURL(blob) : null;
      setPreview({ blob, url });
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(false);
    try {
      const blob = preview ? preview.blob : await renderThumbnail();
      onSaved(await saveSetup(name, blob, existing));
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <form
      className="dialog__body setup-save"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="setup-save__art">{preview ? <Thumb src={preview.url} name={name} /> : <span className="spinner" aria-label="Rendering preview" />}</div>
      <div className="setup-save__form">
        <label className="field">
          <span className="field__label">Name</span>
          <input className="text-input" autoFocus value={name} maxLength={120} aria-label="Setup name" onFocus={(e) => e.target.select()} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="help">
          {existing ? `Replaces the saved “${existing.name}”.` : "Keeps the can, colours, artwork, light, water, camera, effects and background."} Stays on this device.
        </p>
        {error && (
          <p className="help setup-save__error" role="alert">
            Couldn't save. Storage may be full or blocked in this browser.
          </p>
        )}
        <div className="dialog__actions dialog__actions--row">
          <button className="btn btn--primary" type="submit" disabled={!name.trim() || saving}>
            {existing ? "Replace" : "Save"}
          </button>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

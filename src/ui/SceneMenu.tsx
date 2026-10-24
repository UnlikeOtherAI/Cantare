import { useEffect, useRef, useState } from "react";
import { newScene, undoSceneChange } from "../platform/persistence";
import { useUi } from "../state/ui";
import { Icon } from "./icons";

/** The scene name in the top bar: rename, save and reuse setups, start over. */
export function SceneMenu({ format }: { format: string }) {
  const sceneName = useUi((s) => s.sceneName);
  const set = useUi((s) => s.set);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const pick = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  const startOver = () => {
    const snapshot = newScene();
    useUi.getState().showToast({ text: "New scene", tone: "ok", action: { label: "Undo", run: () => undoSceneChange(snapshot) } });
  };

  const meta = <span className="doc__meta">{format}</span>;

  return (
    <div className="scene-menu" ref={ref}>
      {renaming ? (
        <div className="doc">
          <input
            className="doc__input"
            autoFocus
            defaultValue={sceneName}
            aria-label="Scene name"
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              set({ sceneName: e.target.value.trim() || "Untitled scene" });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).value = sceneName;
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {meta}
        </div>
      ) : (
        <button className="doc" type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Scene: ${sceneName}`} title="Scene and setups" onClick={() => setOpen(!open)} onDoubleClick={pick(() => setRenaming(true))}>
          <span className="doc__name">{sceneName}</span>
          {meta}
          <Icon name="chev-down" className="doc__chev" />
        </button>
      )}
      {open && (
        <div className="menu menu--start" role="menu" aria-label="Scene">
          <button type="button" role="menuitem" onClick={pick(() => setRenaming(true))}>
            Rename…
          </button>
          <button type="button" role="menuitem" onClick={pick(() => set({ dialog: "save-setup", toast: null }))}>
            Save setup…
          </button>
          <button type="button" role="menuitem" onClick={pick(() => set({ dialog: "setups", toast: null }))}>
            Setups…
          </button>
          <span className="menu__sep" role="separator" />
          <button type="button" role="menuitem" onClick={pick(startOver)}>
            New scene
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { listGallery, removeFromGallery, type GalleryItem } from "../platform/gallery";
import { canShare, isNative, saveImage, shareImage } from "../platform/save";
import { useUi } from "../state/ui";
import { Icon } from "./icons";

interface Entry {
  item: GalleryItem;
  thumb: string;
}

const extension = (type: string) => (type === "image/png" ? "png" : "jpg");
const filename = (item: GalleryItem) => `cantare-${new Date(item.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extension(item.type)}`;

export function GalleryDialog({ onClose }: { onClose(): void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState<{ entry: Entry; url: string } | null>(null);
  const setUi = useUi((s) => s.set);

  useEffect(() => {
    let urls: string[] = [];
    listGallery()
      .then((items) => {
        const mapped = items.map((item) => ({ item, thumb: URL.createObjectURL(item.thumbnail) }));
        urls = mapped.map((m) => m.thumb);
        setEntries(mapped);
        setUi({ galleryCount: items.length });
      })
      .catch(() => setEntries([]));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [setUi]);

  useEffect(() => () => void (open && URL.revokeObjectURL(open.url)), [open]);

  const remove = async (entry: Entry) => {
    await removeFromGallery(entry.item.id);
    setOpen(null);
    setEntries((list) => {
      const next = (list ?? []).filter((e) => e !== entry);
      setUi({ galleryCount: next.length });
      return next;
    });
  };

  return (
    <div className="dialog-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog--gallery" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
        <header className="dialog__head">
          {open && (
            <button className="icon-btn" type="button" aria-label="Back" onClick={() => setOpen(null)}>
              <Icon name="chev-left" />
            </button>
          )}
          <h2 className="dialog__title" id="gallery-title">
            Gallery <span className="dialog__count">{entries?.length ?? ""}</span>
          </h2>
          <span className="group__hint">Saved on this device</span>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {open ? (
          <div className="dialog__body viewer">
            <img className="viewer__img" src={open.url} alt={open.entry.item.title} />
            <div className="render__meta">
              <span>{open.entry.item.title}</span>
              <span className="mono">
                {open.entry.item.width} × {open.entry.item.height} · {extension(open.entry.item.type).toUpperCase()}
              </span>
            </div>
            <div className="viewer__actions">
              <button className="btn btn--primary" type="button" onClick={() => saveImage(open.entry.item.blob, filename(open.entry.item))}>
                <Icon name="download" className="btn__icon" />
                {isNative ? "Save to Photos" : "Download"}
              </button>
              {canShare() && (
                <button className="btn btn--ghost" type="button" onClick={() => shareImage(open.entry.item.blob, filename(open.entry.item)).catch(() => undefined)}>
                  <Icon name="share" className="btn__icon" />
                  Share
                </button>
              )}
              <button className="btn btn--ghost" type="button" onClick={() => remove(open.entry)}>
                <Icon name="trash" className="btn__icon" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog__body gallery">
            {entries?.map((entry) => (
              <button
                key={entry.item.id}
                className="render"
                type="button"
                style={{ ["--ar" as string]: `${entry.item.width}/${entry.item.height}` }}
                onClick={() => setOpen({ entry, url: URL.createObjectURL(entry.item.blob) })}
              >
                <span className="render__art">
                  <img src={entry.thumb} alt="" />
                </span>
                <span className="render__meta">
                  <span>{entry.item.title}</span>
                  <span className="mono">
                    {entry.item.width} × {entry.item.height} · {extension(entry.item.type).toUpperCase()}
                  </span>
                </span>
              </button>
            ))}
            {entries?.length === 0 && (
              <div className="gallery__empty">
                <p className="gallery__empty-title">Nothing saved yet</p>
                <p className="help">Exports land here. They stay on this device.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

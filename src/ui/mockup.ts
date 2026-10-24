// One click, no dialog: the live view as a quick mock-up image.

import { addToGallery } from "../platform/gallery";
import { saveImage } from "../platform/save";
import { useUi } from "../state/ui";
import { formatTitle } from "./panels/CanPanel";
import { getStage } from "./Viewport";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scene";

export async function downloadMockup() {
  const stage = getStage();
  const ui = useUi.getState();
  if (!stage) return;
  const [w, h] = ui.exportAspect;
  const long = Math.min(2048, stage.maxExportSize());
  const width = w >= h ? long : Math.round((long * w) / h);
  const height = w >= h ? Math.round((long * h) / w) : long;
  try {
    const blob = await stage.exportImage({ width, height, type: "image/png" });
    const format = ui.info?.format;
    const filename = `cantare-${slug(ui.sceneName)}-mockup-${width}x${height}.png`;
    await addToGallery({ blob, width, height, type: "image/png", title: `${ui.sceneName} · mock-up${format ? ` · ${formatTitle(format)}` : ""}` });
    ui.set({ galleryCount: useUi.getState().galleryCount + 1 });
    const result = await saveImage(blob, filename);
    ui.showToast({ text: result === "saved" ? "Mock-up saved to Photos" : "Mock-up downloaded", tone: "ok", action: { label: "Gallery", run: () => useUi.getState().set({ dialog: "gallery" }) } });
  } catch {
    ui.showToast({ text: "Couldn't save the mock-up — try again", tone: "danger", action: { label: "Retry", run: downloadMockup } });
  }
}

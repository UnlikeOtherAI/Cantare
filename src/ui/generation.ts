import { generateBackground, type BackgroundShape } from "../platform/api";
import { addRecentBackground } from "../platform/gallery";
import { useEditor } from "../state/editor";
import { useUi } from "../state/ui";
import { getStage } from "./Viewport";

let controller: AbortController | null = null;

export function backgroundShape([w, h]: [number, number]): BackgroundShape {
  return w > h * 1.15 ? "landscape" : h > w * 1.15 ? "portrait" : "square";
}

/** Use an image as the backdrop; when matching light, aim the key light from the photo too. */
export async function applyBackgroundImage(url: string) {
  const editor = useEditor.getState();
  editor.patch("background", { kind: "image", imageUrl: url, visible: true });
  if (!editor.settings.lighting.matchBackground) return;
  // Let the stage load the image, then read the light from it.
  await getStage()?.apply(useEditor.getState().settings);
  const light = getStage()?.estimateLightFromBackground();
  if (light) useEditor.getState().patch("lighting", light);
}

export async function startGeneration() {
  const ui = useUi.getState();
  const prompt = ui.prompt.trim();
  if (prompt.length < 3) return;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  ui.set({ generation: { status: "generating", startedAt: Date.now() } });
  try {
    const image = await generateBackground(prompt, backgroundShape(ui.exportAspect), signal);
    if (signal.aborted) return;
    const blob = await (await fetch(image)).blob();
    const url = URL.createObjectURL(blob);
    await applyBackgroundImage(url);
    useUi.getState().set({ generation: { status: "idle" } });
    addRecentBackground(prompt, blob).catch(() => undefined);
  } catch (error) {
    if (signal.aborted) return;
    useUi.getState().set({ generation: { status: "error", message: error instanceof Error ? error.message : "Generation failed." } });
  }
}

export function cancelGeneration() {
  controller?.abort();
  controller = null;
  useUi.getState().set({ generation: { status: "idle" } });
}

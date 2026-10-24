export type BackgroundSize = "1536x1024" | "1024x1536" | "1024x1024";
export type BackgroundQuality = "low" | "medium" | "high";

export interface BackgroundRequest {
  prompt: string;
  size: BackgroundSize;
  quality: BackgroundQuality;
}

const SIZES: BackgroundSize[] = ["1536x1024", "1024x1536", "1024x1024"];
const QUALITIES: BackgroundQuality[] = ["low", "medium", "high"];

export function parseBackgroundRequest(body: unknown): BackgroundRequest {
  if (typeof body !== "object" || body === null) throw new Error("Expected a JSON object");
  const { prompt, size, quality } = body as Record<string, unknown>;
  if (typeof prompt !== "string" || prompt.trim().length < 3) throw new Error("Describe the background in a few words");
  if (prompt.length > 1000) throw new Error("Keep the description under 1000 characters");
  return {
    prompt: prompt.trim(),
    size: SIZES.includes(size as BackgroundSize) ? (size as BackgroundSize) : "1024x1536",
    quality: QUALITIES.includes(quality as BackgroundQuality) ? (quality as BackgroundQuality) : "high"
  };
}

/**
 * The can is rendered on the device and composited over this image, so the model must
 * leave the product out and give it somewhere to stand.
 */
export function backgroundPrompt(scene: string): string {
  return [
    "Photographic background plate for a premium beverage product shot, shot on a full-frame camera with a long lens.",
    "Do not include any cans, bottles, glasses, packaging, text, logos, labels or people.",
    "Leave a clear, flat surface in the lower centre of the frame where a drinks can will be placed later, lit to match the scene.",
    "Shallow depth of field: the surface in front is in focus and the distance falls softly out of focus.",
    `Scene: ${scene}`
  ].join(" ");
}

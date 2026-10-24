const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export type BackgroundShape = "portrait" | "landscape" | "square";

const SIZE: Record<BackgroundShape, string> = {
  portrait: "1024x1536",
  landscape: "1536x1024",
  square: "1024x1024"
};

/** Generate a background plate through the Cantare server (and Ledger). Returns a data URL. */
export async function generateBackground(prompt: string, shape: BackgroundShape, signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/backgrounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size: SIZE[shape], quality: "high" }),
      signal
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Could not reach Cantare. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!response.ok || !body.image) throw new Error(body.error ?? "Background generation failed.");
  return body.image;
}

/** Whether this deployment can generate backgrounds (false when Ledger is not configured). */
export async function generationAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const body = (await response.json()) as { generation?: boolean };
    return Boolean(body.generation);
  } catch {
    return false;
  }
}

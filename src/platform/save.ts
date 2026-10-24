// Getting a finished render off the device: a download on the web, the photo library
// or share sheet in the native apps.

import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function writeCacheFile(blob: Blob, filename: string) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  return result.uri;
}

/** Web: download the file. Native: save it to the photo library. */
export async function saveImage(blob: Blob, filename: string): Promise<"downloaded" | "saved"> {
  if (isNative) {
    const { Media } = await import("@capacitor-community/media");
    const path = await writeCacheFile(blob, filename);
    await Media.savePhoto({ path, fileName: filename.replace(/\.[^.]+$/, "") });
    return "saved";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}

export function canShare(): boolean {
  if (isNative) return true;
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
}

/** System share sheet (native, or mobile browsers that can share files). */
export async function shareImage(blob: Blob, filename: string): Promise<void> {
  if (isNative) {
    const { Share } = await import("@capacitor/share");
    const url = await writeCacheFile(blob, filename);
    await Share.share({ title: "Cantare render", files: [url] });
    return;
  }
  const file = new File([blob], filename, { type: blob.type });
  await navigator.share({ files: [file], title: "Cantare render" });
}

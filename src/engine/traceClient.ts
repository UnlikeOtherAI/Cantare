// Talks to the path-tracing worker. One worker for the page's lifetime keeps the
// compiled tracer warm between renders.

import type { TraceMessage, TraceRequest } from "./traceWorker";

let worker: Worker | null = null;
let nextId = 1;
const jobs = new Map<number, { resolve(value: { width: number; height: number; pixels: Uint16Array }): void; reject(error: Error): void; onStage?(stage: "preparing" | "tracing"): void; onProgress?(samples: number, total: number): void }>();

function workerInstance() {
  if (!worker) {
    worker = new Worker(new URL("./traceWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<TraceMessage>) => {
      const message = event.data;
      const job = jobs.get(message.id);
      if (!job) return;
      if (message.type === "stage") job.onStage?.(message.stage);
      else if (message.type === "progress") job.onProgress?.(message.samples, message.total);
      else {
        jobs.delete(message.id);
        if (message.type === "done") job.resolve(message);
        else job.reject(message.cancelled ? new DOMException("Render cancelled", "AbortError") : new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      for (const job of jobs.values()) job.reject(new Error(event.message || "The renderer stopped"));
      jobs.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export function traceInWorker(
  request: Omit<TraceRequest, "type" | "id">,
  transfer: Transferable[],
  options: { onStage?(stage: "preparing" | "tracing"): void; onProgress?(samples: number, total: number): void; signal?: AbortSignal }
): Promise<{ width: number; height: number; pixels: Uint16Array }> {
  const id = nextId++;
  const w = workerInstance();
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject, onStage: options.onStage, onProgress: options.onProgress });
    options.signal?.addEventListener("abort", () => w.postMessage({ type: "cancel", id }), { once: true });
    w.postMessage({ ...request, type: "render", id }, transfer);
  });
}

export function stopTraceWorker() {
  worker?.terminate();
  worker = null;
  for (const job of jobs.values()) job.reject(new DOMException("Render cancelled", "AbortError"));
  jobs.clear();
}

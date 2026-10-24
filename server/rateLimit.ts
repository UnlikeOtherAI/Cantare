/** Fixed-window limiter per client key. In-memory: one server process. */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();
  private limit: number;
  private windowMs: number;
  private now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** Takes one unit; returns 0 when allowed, else milliseconds until the window resets. */
  take(key: string): number {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    if (window.count >= this.limit) return window.start + this.windowMs - now;
    window.count++;
    if (this.windows.size > 10_000) this.prune(now);
    return 0;
  }

  /** Give a unit back when the upstream call failed. */
  refund(key: string) {
    const window = this.windows.get(key);
    if (window && window.count > 0) window.count--;
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
  }
}

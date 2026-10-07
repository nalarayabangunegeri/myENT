// Coalescing refresh per-session (KURANG.md §7): request konkuren milik satu
// refresh token berbagi satu promise; session lain tidak terpengaruh.
// ponytail: in-memory per-instance. Ceiling: store eksternal saat multi-replica.
export class RefreshCoalescer {
  private running = new Map<string, Promise<boolean>>();

  run(key: string, fn: () => Promise<boolean>): Promise<boolean> {
    const live = this.running.get(key);
    if (live) return live;
    const p = fn().finally(() => {
      if (this.running.get(key) === p) this.running.delete(key);
    });
    this.running.set(key, p);
    return p;
  }
}

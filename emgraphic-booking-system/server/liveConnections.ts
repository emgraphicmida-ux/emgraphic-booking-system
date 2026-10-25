// Each visitor may hold a small number of tabs; idle public streams must not
// reserve unlimited sockets/timers. Polling remains available when full.
export class LiveConnectionLimit {
  private perIp = new Map<string, number>();
  private total = 0;
  constructor(private maximumPerIp = 16, private maximumTotal = 256) {}
  acquire(ip: string): (() => void) | undefined {
    const count = this.perIp.get(ip) || 0;
    if (count >= this.maximumPerIp || this.total >= this.maximumTotal) return;
    this.perIp.set(ip, count + 1); this.total++;
    let released = false;
    return () => {
      if (released) return;
      released = true; this.total--;
      const remaining = (this.perIp.get(ip) || 1) - 1;
      if (remaining) this.perIp.set(ip, remaining);
      else this.perIp.delete(ip);
    };
  }
}

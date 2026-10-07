import { describe, expect, it } from 'vitest';
import { RefreshCoalescer } from './refresh-coalescer';

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('RefreshCoalescer (KURANG.md §7)', () => {
  it('request konkuren satu session berbagi satu eksekusi', async () => {
    const c = new RefreshCoalescer();
    let calls = 0;
    const fn = async () => {
      calls++;
      await tick();
      return true;
    };
    const [a, b, d] = await Promise.all([c.run('sess-A', fn), c.run('sess-A', fn), c.run('sess-A', fn)]);
    expect([a, b, d]).toEqual([true, true, true]);
    expect(calls).toBe(1);
  });

  it('session berbeda tidak saling memengaruhi', async () => {
    const c = new RefreshCoalescer();
    let calls = 0;
    const fn = async () => {
      calls++;
      await tick();
      return true;
    };
    const [a, b] = await Promise.all([c.run('sess-A', fn), c.run('sess-B', fn)]);
    expect([a, b]).toEqual([true, true]);
    expect(calls).toBe(2);
  });

  it('kegagalan ikut dibagikan lalu slot dibersihkan', async () => {
    const c = new RefreshCoalescer();
    let calls = 0;
    const fail = async () => {
      calls++;
      await tick();
      return false;
    };
    const [a, b] = await Promise.all([c.run('sess-A', fail), c.run('sess-A', fail)]);
    expect([a, b]).toEqual([false, false]);
    expect(calls).toBe(1);
    await c.run('sess-A', async () => {
      calls++;
      return true;
    });
    expect(calls).toBe(2);
  });
});

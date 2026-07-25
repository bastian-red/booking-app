import { describe, it, expect } from 'vitest';
import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(true), false, 50)).resolves.toBe(true);
  });

  it('resolves with the fallback when the promise hangs past the deadline', async () => {
    // A never-settling promise stands in for a Redis command stuck in the
    // offline queue while the server is down — health must not block on it.
    const hang = new Promise<boolean>(() => {});
    const start = Date.now();
    await expect(withTimeout(hang, false, 30)).resolves.toBe(false);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('resolves with the fallback when the promise rejects', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), null, 50)).resolves.toBeNull();
  });
});

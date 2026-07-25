/**
 * Races a promise against a deadline. If it does not settle within `ms`, or it
 * rejects, resolves to `fallback`. Used by the health check so a hung or failing
 * dependency (e.g. a disconnected Redis whose command sits in the offline queue)
 * makes /health return 503 quickly instead of blocking forever.
 */
export function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 2_000): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

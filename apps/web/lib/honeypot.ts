/**
 * Server-side bot trap for the signup form. Two independent signals:
 *
 *  1. A hidden `company` field that real users never see or fill. Any value in
 *     it means a bot walked the DOM and filled every input.
 *  2. A render timestamp: a human takes longer than MIN_FILL_MS to read the form
 *     and type. A submit that arrives faster than that was almost certainly
 *     scripted.
 *
 * Kept as a pure function so it is unit-testable without a browser or a server
 * action harness.
 */
export const MIN_FILL_MS = 2000;

export interface HoneypotInput {
  /** Value of the hidden `company` field. */
  company: string;
  /** Epoch ms the form was rendered (from the hidden `_ts` field). */
  ts: number;
  /** Epoch ms now (defaults to Date.now()). */
  now?: number;
}

export function isHoneypotTripped({ company, ts, now = Date.now() }: HoneypotInput): boolean {
  if (company.trim().length > 0) return true;
  // Missing/garbage timestamp -> treat as suspicious (a real form always sends it).
  if (!Number.isFinite(ts) || ts <= 0) return true;
  const elapsed = now - ts;
  // Too fast, or a timestamp from the future (clock tampering).
  if (elapsed < MIN_FILL_MS) return true;
  return false;
}

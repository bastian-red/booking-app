import { describe, expect, it } from 'vitest';
import { isHoneypotTripped, MIN_FILL_MS } from './honeypot';

describe('isHoneypotTripped', () => {
  const rendered = 1_000_000;
  const human = rendered + MIN_FILL_MS + 500;

  it('passes a clean, human-paced submission', () => {
    expect(isHoneypotTripped({ company: '', ts: rendered, now: human })).toBe(false);
  });

  it('trips when the hidden company field is filled', () => {
    expect(isHoneypotTripped({ company: 'Acme Corp', ts: rendered, now: human })).toBe(true);
  });

  it('trips when the company field has only whitespace-wrapped content', () => {
    expect(isHoneypotTripped({ company: '  x ', ts: rendered, now: human })).toBe(true);
  });

  it('trips when the form is submitted faster than a human could fill it', () => {
    expect(isHoneypotTripped({ company: '', ts: rendered, now: rendered + 200 })).toBe(true);
  });

  it('trips on a missing or invalid timestamp', () => {
    expect(isHoneypotTripped({ company: '', ts: NaN, now: human })).toBe(true);
    expect(isHoneypotTripped({ company: '', ts: 0, now: human })).toBe(true);
  });

  it('trips on a future timestamp (clock tampering)', () => {
    expect(isHoneypotTripped({ company: '', ts: human + 10_000, now: human })).toBe(true);
  });
});

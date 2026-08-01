import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractTokens, resolve } from './contrast';

/**
 * The identity lock.
 *
 * This repo is one of a portfolio, and the portfolio's failure mode is that
 * every project ends up wearing whatever visual language the last one wore.
 * That is not hypothetical: this app and the e-commerce one previously shipped
 * a byte-identical token block and the same three typefaces, so a reader
 * opening both saw one designer with one trick.
 *
 * "Booking looks like Booking" is not a judgement call — it is a set of values
 * in two files. So it lives here, where drifting back toward a shared palette
 * fails a commit instead of passing review.
 *
 * When the identity genuinely changes, change these constants deliberately and
 * say why in the commit. That is the point: it should cost a decision.
 */
const APP = join(__dirname, '..', 'app');
const globals = readFileSync(join(APP, 'globals.css'), 'utf8');
const layout = readFileSync(join(APP, 'layout.tsx'), 'utf8');

/** "Calm precision" — see the header comment in app/globals.css. */
const IDENTITY = {
  light: { '--bg': '#fafaf8', '--accent': '#4f46e5' },
  dark: { '--bg': '#101319', '--accent': '#818cf8' },
  radius: '10px',
  fonts: ['Fraunces', 'Inter'],
} as const;

const light = extractTokens(globals, ':root');
const dark = { ...light, ...extractTokens(globals, '@media (prefers-color-scheme: dark)') };

/** Every face this app pulls out of `next/font/google`. */
function importedFaces(): string[] {
  const line = /import\s*\{([^}]*)\}\s*from\s*'next\/font\/google'/.exec(layout);
  if (!line) throw new Error('layout.tsx imports nothing from next/font/google');
  return line[1]!
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

describe('visual identity', () => {
  it.each(Object.entries(IDENTITY.light))('light %s is %s', (token, expected) => {
    expect(resolve(light, token).toLowerCase()).toBe(expected);
  });

  it.each(Object.entries(IDENTITY.dark))('dark %s is %s', (token, expected) => {
    expect(resolve(dark, token).toLowerCase()).toBe(expected);
  });

  it('loads exactly the faces this identity is built on', () => {
    // Exact, not "at least": an extra face is how a shared house style creeps
    // back in one import at a time.
    expect(importedFaces().sort()).toEqual([...IDENTITY.fonts].sort());
  });

  it('carries no monospace face', () => {
    // Deliberate: a mono face reads as "developer tool", and the guest on the
    // booking page is not one. Times are set in Inter's tabular figures.
    expect(importedFaces().join(' ')).not.toMatch(/Mono|Code|Courier/);
    expect(globals).not.toMatch(/--ff-mono|font-family:[^;]*monospace/);
  });

  it('is not sharp-cornered', () => {
    // A 0px radius is the tell of the design language this repo moved away
    // from. Rounded is the identity, not a preference.
    expect(light['--radius']).toBe(IDENTITY.radius);
  });

  it('does not reintroduce the shared signal red', () => {
    // #ff0000 was the one accent all three portfolio projects shared.
    const reds = [...globals.matchAll(/#ff0000|#f00\b/gi)];
    expect(reds, 'the portfolio-wide signal red must not come back').toHaveLength(0);
  });
});

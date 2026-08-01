import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AA_NORMAL,
  AA_UI,
  contrastRatio,
  extractTokens,
  parseHex,
  ratio,
  relativeLuminance,
  resolve,
} from './contrast';

/**
 * The colour gate.
 *
 * Every foreground/background pair the product actually renders is checked
 * against WCAG AA, in both colour schemes. It reads the real stylesheet, so it
 * cannot pass against a stale copy of the palette — a contrast test that scores
 * a duplicated palette is worse than no test, because it reports safety that is
 * not there.
 *
 * This exists because the axe baseline taken before the redesign found 31
 * contrast failures on the booking page in dark mode, all from one token pair,
 * and nobody saw it by looking. Contrast is arithmetic. Arithmetic belongs in a
 * test, not in anyone's eye.
 */
const APP = join(__dirname, '..', 'app');
const globals = readFileSync(join(APP, 'globals.css'), 'utf8');

/**
 * Light is the default palette, declared on the single `:root` block alongside
 * the spacing and type primitives. `extractTokens` matches the first block
 * whose selector text matches, which is why that block must stay singular.
 */
const light = extractTokens(globals, ':root');
const dark = { ...light, ...extractTokens(globals, '@media (prefers-color-scheme: dark)') };

const PALETTES = { light, dark } as const;

/** Backgrounds any of these foregrounds can legitimately land on. */
const BACKGROUNDS = ['--bg', '--surface', '--surface-2'] as const;

/**
 * Text-weight foregrounds: must clear 4.5:1 on every background.
 *
 * `--accent` is deliberately absent. It is a fill and a focus ring, never a
 * text colour — `--accent-ink` is the text-weight variant — so it answers to
 * the 3:1 of WCAG 1.4.11 rather than the 4.5:1 of 1.4.3, and is asserted
 * separately below.
 */
const TEXT = [
  '--text',
  '--muted',
  '--accent-ink',
  '--state-ok',
  '--state-warn',
  '--state-err',
] as const;

describe('pure contrast maths', () => {
  it('computes the canonical extremes', () => {
    expect(ratio('#000000', '#ffffff')).toBe(21);
    expect(ratio('#ffffff', '#ffffff')).toBe(1);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(
      contrastRatio('#abcdef', '#123456'),
      10,
    );
  });

  it('expands three-digit hex', () => {
    expect(parseHex('#fff')).toEqual(parseHex('#ffffff'));
    expect(parseHex('0af')).toEqual({ r: 0, g: 170, b: 255 });
  });

  it('rejects nonsense rather than scoring it', () => {
    expect(() => parseHex('rebeccapurple')).toThrow(/not a hex colour/);
    expect(() => parseHex('#12345')).toThrow(/not a hex colour/);
  });

  it('matches the WCAG luminance of the reference greys', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBe(0);
    expect(relativeLuminance(parseHex('#ffffff'))).toBeCloseTo(1, 10);
    expect(relativeLuminance(parseHex('#808080'))).toBeCloseTo(0.2159, 3);
  });
});

describe('token extraction', () => {
  it('reads custom properties out of a block', () => {
    const tokens = extractTokens(':root { --a: #fff; --b: 4px; }', ':root');
    expect(tokens).toEqual({ '--a': '#fff', '--b': '4px' });
  });

  it('walks nested braces so a media query does not truncate the block', () => {
    const css = '@media (prefers-color-scheme: dark) { :root { --a: #000; } }';
    expect(extractTokens(css, '@media (prefers-color-scheme: dark)')).toEqual({ '--a': '#000' });
  });

  it('follows var() indirection', () => {
    expect(resolve({ '--a': 'var(--b)', '--b': '#123456' }, '--a')).toBe('#123456');
  });

  it('throws on a circular reference instead of hanging', () => {
    expect(() => resolve({ '--a': 'var(--b)', '--b': 'var(--a)' }, '--a')).toThrow(/circular/);
  });

  it('throws on a missing token rather than skipping the check', () => {
    expect(() => resolve({}, '--nope')).toThrow(/undefined token/);
  });

  it('found a real palette in both schemes', () => {
    for (const [name, palette] of Object.entries(PALETTES)) {
      expect(resolve(palette, '--text'), name).toMatch(/^#/);
      expect(resolve(palette, '--bg'), name).toMatch(/^#/);
    }
  });

  it('the two schemes are actually different', () => {
    // Guards a copy-paste: a dark block that never overrode --bg would pass
    // every ratio below while shipping a white page to a dark-mode reader.
    expect(resolve(dark, '--bg')).not.toBe(resolve(light, '--bg'));
    expect(resolve(dark, '--text')).not.toBe(resolve(light, '--text'));
  });
});

describe.each(Object.entries(PALETTES))('%s palette', (scope, palette) => {
  describe.each(TEXT)('%s', (fg) => {
    it.each(BACKGROUNDS)('clears AA on %s', (bg) => {
      const foreground = resolve(palette, fg);
      const background = resolve(palette, bg);
      const measured = ratio(foreground, background);
      expect(
        measured,
        `${scope}: ${fg} (${foreground}) on ${bg} (${background}) is ${measured}:1, needs ${AA_NORMAL}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  it.each(BACKGROUNDS)('--border-strong bounds a control against %s', (bg) => {
    // Input edges and the calendar's "today" ring are non-text UI: WCAG 1.4.11,
    // 3:1. They sit on all three surfaces, not just --bg.
    const border = resolve(palette, '--border-strong');
    const background = resolve(palette, bg);
    const measured = ratio(border, background);
    expect(
      measured,
      `${scope}: --border-strong (${border}) on ${bg} (${background}) is ${measured}:1, needs ${AA_UI}:1`,
    ).toBeGreaterThanOrEqual(AA_UI);
  });

  it.each(BACKGROUNDS)('--accent reads as a control boundary against %s', (bg) => {
    // .btn-primary's fill, the selected day, the selected slot, the input focus
    // border. Non-text UI, so 3:1 — and this is the check that forced dark mode
    // onto a lighter indigo: #4f46e5 on #101319 is only 2.96:1.
    const accent = resolve(palette, '--accent');
    const background = resolve(palette, bg);
    const measured = ratio(accent, background);
    expect(
      measured,
      `${scope}: --accent (${accent}) on ${bg} (${background}) is ${measured}:1, needs ${AA_UI}:1`,
    ).toBeGreaterThanOrEqual(AA_UI);
  });

  it('the primary button label is readable on its own fill', () => {
    const measured = ratio(resolve(palette, '--on-accent'), resolve(palette, '--accent'));
    expect(
      measured,
      `${scope}: --on-accent on --accent is ${measured}:1, needs ${AA_NORMAL}:1`,
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('the accent wash still carries accent-ink and body text', () => {
    // .eyebrow and the hovered slot paint --accent-ink on --accent-wash, which
    // is not in BACKGROUNDS because nothing else lands on it.
    const wash = resolve(palette, '--accent-wash');
    for (const fg of ['--accent-ink', '--text'] as const) {
      const measured = ratio(resolve(palette, fg), wash);
      expect(
        measured,
        `${scope}: ${fg} on --accent-wash (${wash}) is ${measured}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('--surface is distinguishable from --bg', () => {
    // Not a WCAG rule, a real regression class: a --surface equal to --bg makes
    // every .card and .cal silently lose its surface.
    expect(resolve(palette, '--surface'), `${scope}: --surface must not equal --bg`).not.toBe(
      resolve(palette, '--bg'),
    );
  });

  it('the three booking states are three different colours', () => {
    const states = ['--state-ok', '--state-warn', '--state-err'].map((t) => resolve(palette, t));
    expect(new Set(states).size, `${scope}: state tokens must be distinct`).toBe(3);
  });
});

/**
 * The greyscale channel.
 *
 * Confirmed / pending / cancelled cannot be told apart by luminance alone, and
 * no palette fixes that: in dark mode every state colour must clear 4.5:1
 * against a near-black canvas, which forces all three into a narrow luminance
 * band, so green and red land within about 1.1:1 of each other. That is the
 * most common colour-vision deficiency there is, rendering both as one grey.
 *
 * Measured rather than assumed, so the claim above stays honest — and so does
 * the consequence: because colour cannot carry the state, the glyph and the
 * word have to, and this asserts the glyphs are actually distinct.
 */
describe('state survives greyscale', () => {
  const glyph = (variant: string): string => {
    const rule = new RegExp(`\\.badge-${variant}::before\\s*\\{([^}]*)\\}`).exec(globals);
    if (!rule) throw new Error(`no ::before rule for .badge-${variant}`);
    const content = /content:\s*'([^']*)'/.exec(rule[1]!);
    if (!content) throw new Error(`.badge-${variant}::before declares no content`);
    return content[1]!;
  };

  it('gives each state its own glyph', () => {
    const glyphs = ['ok', 'warn', 'err'].map(glyph);
    expect(new Set(glyphs).size, `badge glyphs must be distinct, got ${glyphs.join(' ')}`).toBe(3);
    for (const g of glyphs) expect(g.trim().length).toBeGreaterThan(0);
  });

  it.each(Object.entries(PALETTES))(
    'documents that %s colour alone is not enough',
    (_scope, palette) => {
      // Not a requirement being enforced, a fact being recorded. If a future
      // palette ever does separate these in greyscale this will fail, and the
      // comment above should be revisited rather than the number nudged.
      const measured = ratio(resolve(palette, '--state-ok'), resolve(palette, '--state-err'));
      expect(measured).toBeLessThan(3);
    },
  );
});

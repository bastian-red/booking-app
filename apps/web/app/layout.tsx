import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Inter } from 'next/font/google';

/**
 * Two faces, no monospace.
 *
 * Fraunces is a variable serif with a soft, slightly old-style axis. It carries
 * the headings, where the job is warmth: a page that asks a stranger for their
 * email should not look like a terminal.
 *
 * Inter carries everything a person reads or types — labels, body, times, table
 * cells — because its tabular figures line up in a column, which is exactly
 * what a list of slots and a table of bookings need.
 *
 * There is deliberately no mono face. Mono reads as "developer tool", and the
 * guest on the booking page is not one.
 *
 * Both are self-hosted by next/font at build time, so no runtime request leaves
 * for a font CDN.
 */
const display = Fraunces({
  subsets: ['latin'],
  // No `weight`, on purpose. Passing one makes next/font emit static instances,
  // and `axes` is rejected for those ("Axes can only be defined for variable
  // fonts"). Omitting it ships the variable face, so the weight axis is
  // continuous and `opsz` — Fraunces' optical size — comes along with it.
  // Without opsz the face renders at its body-copy optical size, which looks
  // thin and wide at headline sizes.
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
});
const ui = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ui',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Booking',
  description: 'Concurrency-safe, timezone-correct scheduling (Calendly-style).',
};

/**
 * Matches the browser chrome to the page. Without this a mobile browser paints
 * its address bar in the default colour and the page appears to float on a
 * differently-coloured strip.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#101319' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}

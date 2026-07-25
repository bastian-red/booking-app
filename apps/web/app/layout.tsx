import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import localFont from 'next/font/local';

// Nothing-style type system: a grotesk for display/body, a mono for metadata and
// labels, and a dot-matrix face for the brand mark and numeric accents. All three
// are self-hosted by next/font at build time (no runtime CDN request).
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-display',
  display: 'swap',
});
const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});
// Doto isn't in next/font/google's registry for this Next version, so the
// OFL-licensed variable woff2 (latin subset, weights 100–900) is self-hosted.
const doto = localFont({
  src: './fonts/doto.woff2',
  weight: '100 900',
  variable: '--font-dot',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Booking',
  description: 'Concurrency-safe, timezone-correct scheduling (Calendly-style).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} ${doto.variable}`}>
      <body>{children}</body>
    </html>
  );
}

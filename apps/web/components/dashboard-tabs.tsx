'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Event types' },
  { href: '/dashboard/availability', label: 'Availability' },
  { href: '/dashboard/bookings', label: 'Bookings' },
] as const;

/**
 * A tab strip rather than a row of links.
 *
 * These three are peers and a host moves between them constantly, so they need
 * to look like one control rather than like body copy that happens to be
 * clickable. `aria-current="page"` carries the selected state, which is what
 * lets the CSS underline it without inventing a colour-only signal.
 *
 * A client component only because the current path is needed; nothing else here
 * is interactive.
 */
export function DashboardTabs() {
  const pathname = usePathname();
  return (
    <nav className="subnav" aria-label="Dashboard sections">
      {TABS.map((tab) => {
        // Exact match for the index tab, prefix match for the rest, so
        // /dashboard/event-types/new still highlights "Event types".
        const active =
          tab.href === '/dashboard'
            ? pathname === '/dashboard' || pathname.startsWith('/dashboard/event-types')
            : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

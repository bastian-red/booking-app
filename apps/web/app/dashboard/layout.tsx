import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Nav } from '@/components/nav';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <>
      <Nav />
      <div className="container">
        <div className="row" style={{ marginBottom: 20, gap: 20 }}>
          <Link href="/dashboard">Event types</Link>
          <Link href="/dashboard/availability">Availability</Link>
          <Link href="/dashboard/bookings">Bookings</Link>
        </div>
        {children}
      </div>
    </>
  );
}

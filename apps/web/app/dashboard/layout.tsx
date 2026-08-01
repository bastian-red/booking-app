import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Nav } from '@/components/nav';
import { DashboardTabs } from '@/components/dashboard-tabs';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main className="container" id="main">
        <DashboardTabs />
        {children}
      </main>
    </>
  );
}

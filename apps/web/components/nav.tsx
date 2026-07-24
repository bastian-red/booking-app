import Link from 'next/link';
import { auth, signOut } from '../auth';

export async function Nav() {
  const session = await auth();
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        📅 Booking
      </Link>
      <div className="links">
        <Link href="/status">Status</Link>
        {session?.user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button className="btn" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn btn-primary">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

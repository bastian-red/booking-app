import Link from 'next/link';
import { auth, signOut } from '../auth';

export async function Nav() {
  const session = await auth();
  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/" className="brand">
        {/* A clock face drawn in CSS. Decorative: the accessible name is the
            word beside it, so it stays out of the a11y tree. */}
        <span className="mark" aria-hidden="true" />
        Booking
      </Link>
      <div className="links">
        {session?.user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button className="btn btn-quiet" type="submit">
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

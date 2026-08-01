import Link from 'next/link';
import { Nav } from '../components/nav';

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main className="container" id="main">
        <section className="hero">
          <p className="eyebrow">Timezone-correct scheduling</p>
          <h1>Scheduling that never double-books.</h1>
          <p>
            A Calendly-style booking platform with timezone-correct slots, concurrency-safe
            reservations backed by a Postgres exclusion constraint, Stripe payments, and email
            reminders.
          </p>
          <div className="row" style={{ marginTop: 'var(--s-6)' }}>
            <Link href="/signup" className="btn btn-primary">
              Create your booking page
            </Link>
            <Link href="/login" className="btn">
              Log in
            </Link>
          </div>
        </section>

        <div className="grid">
          <div className="card">
            <h3>Timezone correct</h3>
            <p className="muted">
              Availability is stored in your local time and resolved to UTC with full DST handling,
              then shown to guests in their own timezone.
            </p>
          </div>
          <div className="card">
            <h3>No double-booking</h3>
            <p className="muted">
              A GiST exclusion constraint makes overlapping bookings structurally impossible, even
              under heavy concurrency. A Redis lock keeps errors clean.
            </p>
          </div>
          <div className="card">
            <h3>Payments &amp; reminders</h3>
            <p className="muted">
              Paid event types checkout with Stripe (idempotent webhooks). Confirmation and reminder
              emails are delivered by a background worker queue.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

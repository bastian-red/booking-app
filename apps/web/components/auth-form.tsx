'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { scorePassword } from '@booking/shared';
import type { AuthState } from '../app/auth-actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Please wait…' : label}
    </button>
  );
}

/** Segmented strength meter driven by the shared scorePassword policy. */
function StrengthMeter({ password }: { password: string }) {
  const { score, label, valid } = useMemo(() => scorePassword(password), [password]);
  const segments = [1, 2, 3, 4];
  return (
    <div className="strength" aria-live="polite">
      <div className="strength-bars">
        {segments.map((n) => (
          <span key={n} className={`strength-seg${n <= score ? ' on' : ''}`} />
        ))}
      </div>
      <span className="strength-label mono">
        {password.length === 0 ? 'PASSWORD STRENGTH' : `${label.toUpperCase()}${valid ? '' : ' · needs 10+ chars, A-z, 0-9'}`}
      </span>
    </div>
  );
}

export function AuthForm({
  mode,
  action,
}: {
  mode: 'login' | 'signup';
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [tz, setTz] = useState('UTC');
  const [password, setPassword] = useState('');
  // Stable render timestamp for the honeypot fill-time check.
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setTz('UTC');
    }
  }, []);

  const isSignup = mode === 'signup';

  return (
    <div className="auth-wrap">
      <div className="card">
        <h2 className="center">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        <form action={formAction}>
          {isSignup && (
            <>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required autoComplete="name" />
              <input type="hidden" name="timezone" value={tz} />
              <input type="hidden" name="_ts" value={renderedAt} />
              {/* Honeypot: hidden from humans, tempting to bots. Never fill this. */}
              <div className="hp" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
              </div>
            </>
          )}
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            onChange={isSignup ? (e) => setPassword(e.target.value) : undefined}
          />
          {isSignup && <StrengthMeter password={password} />}
          <div style={{ marginTop: 16 }}>
            <SubmitButton label={isSignup ? 'Sign up' : 'Log in'} />
          </div>
          {state?.error && <p className="error">{state.error}</p>}
        </form>
        <p className="center muted" style={{ marginTop: 16 }}>
          {isSignup ? (
            <>
              Already have an account? <Link href="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Create an account</Link>
            </>
          )}
        </p>
        {isSignup && <p className="center muted">Detected timezone: {tz}</p>}
      </div>
    </div>
  );
}

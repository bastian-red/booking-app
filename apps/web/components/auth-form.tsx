'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { AuthState } from '../app/auth-actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Please wait…' : label}
    </button>
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
          />
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

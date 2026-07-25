'use server';

import { AuthError } from 'next-auth';
import { signupSchema } from '@booking/shared';
import { signIn } from '@/auth';
import { publicApiFetch, ApiError } from '@/lib/api';
import { isHoneypotTripped } from '@/lib/honeypot';

export type AuthState = { error?: string } | undefined;

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  try {
    await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Invalid email or password' };
    throw err; // NEXT_REDIRECT and others must propagate.
  }
  return undefined;
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Bot trap: reject filled honeypot or impossibly fast submissions. The message
  // is intentionally generic so a bot cannot learn why it was blocked.
  if (
    isHoneypotTripped({
      company: String(formData.get('company') ?? ''),
      ts: Number(formData.get('_ts')),
    })
  ) {
    return { error: 'Could not create the account. Please try again.' };
  }

  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
    timezone: formData.get('timezone') || 'UTC',
  });
  if (!parsed.success) {
    // Surface the first specific rule (password policy, email, name) to the user.
    return { error: parsed.error.issues[0]?.message ?? 'Please check your details.' };
  }

  try {
    await publicApiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Account created. Please log in.' };
    }
    throw err;
  }
  return undefined;
}

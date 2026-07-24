'use server';

import { AuthError } from 'next-auth';
import { signupSchema } from '@booking/shared';
import { signIn } from '@/auth';
import { publicApiFetch, ApiError } from '@/lib/api';

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
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
    timezone: formData.get('timezone') || 'UTC',
  });
  if (!parsed.success) {
    return { error: 'Check your details (password needs at least 8 characters).' };
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

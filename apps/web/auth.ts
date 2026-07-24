import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginSchema } from '@booking/shared';
import { API_BASE_URL } from './lib/config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) return null;
        const user = (await res.json()) as {
          id: string;
          email: string;
          name: string;
          timezone: string;
        };
        return user;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.timezone = (user as { timezone: string }).timezone;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.timezone = token.timezone;
      return session;
    },
  },
});

import jwt from 'jsonwebtoken';

/**
 * Mint a short-lived HS256 token the NestJS API verifies with the shared
 * AUTH_SECRET. The web server holds the Auth.js session and forwards this token
 * when calling host-scoped API endpoints.
 */
export function mintServiceToken(userId: string, email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return jwt.sign({ sub: userId, email }, secret, { algorithm: 'HS256', expiresIn: '5m' });
}

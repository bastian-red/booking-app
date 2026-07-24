import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from './auth.guard';
import type { AppConfig } from '../config/config';

const secret = 'test-secret-least-16-chars';
const config = { authSecret: secret } as AppConfig;

function contextWith(req: Partial<AuthedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard(config);

  it('accepts a valid HS256 token and sets hostId', () => {
    const token = jwt.sign({ sub: 'host_1', email: 'h@example.com' }, secret, {
      algorithm: 'HS256',
    });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthedRequest;
    expect(guard.canActivate(contextWith(req))).toBe(true);
    expect(req.hostId).toBe('host_1');
    expect(req.hostEmail).toBe('h@example.com');
  });

  it('rejects a missing token', () => {
    const req = { headers: {} } as AuthedRequest;
    expect(() => guard.canActivate(contextWith(req))).toThrow();
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'x' }, 'other-secret-least-16chars', { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthedRequest;
    expect(() => guard.canActivate(contextWith(req))).toThrow();
  });
});

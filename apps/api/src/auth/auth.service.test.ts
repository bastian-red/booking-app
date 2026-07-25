import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import * as password from './password';
import type { PrismaService } from '../prisma/prisma.service';

function makeService(findUnique: ReturnType<typeof vi.fn>): AuthService {
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  return new AuthService(prisma);
}

describe('AuthService.login anti-enumeration', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('runs a password verification even when the email is unknown', async () => {
    const verifySpy = vi.spyOn(password, 'verifyPassword');
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = makeService(findUnique);

    await expect(service.login({ email: 'ghost@example.com', password: 'whatever123A' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // The oracle is closed: the unknown-email path still spends a scrypt verify.
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a known email with the wrong password using the same generic message', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'real@example.com',
      name: 'Real',
      timezone: 'UTC',
      passwordHash: password.hashPassword('CorrectHorse1'),
    });
    const service = makeService(findUnique);

    await expect(
      service.login({ email: 'real@example.com', password: 'WrongPass1' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('returns the safe user on correct credentials', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'real@example.com',
      name: 'Real',
      timezone: 'UTC',
      passwordHash: password.hashPassword('CorrectHorse1'),
    });
    const service = makeService(findUnique);

    await expect(service.login({ email: 'real@example.com', password: 'CorrectHorse1' })).resolves.toEqual({
      id: 'u1',
      email: 'real@example.com',
      name: 'Real',
      timezone: 'UTC',
    });
  });
});

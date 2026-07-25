import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@booking/db';
import type { LoginInput, SignupInput } from '@booking/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';

/**
 * A real scrypt hash of a value no user can have. When a login targets an
 * unknown email we still verify against this, so the request costs the same
 * whether or not the account exists — closing the timing-based enumeration
 * oracle that a bare `if (!user) throw` would open.
 */
const DUMMY_PASSWORD_HASH = hashPassword('timing-equalizer-not-a-real-password');

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(input: SignupInput): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          timezone: input.timezone,
          passwordHash: hashPassword(input.password),
        },
        select: { id: true, email: true, name: true, timezone: true },
      });
      return user;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(input: LoginInput): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    // Always run a verification, even for unknown emails, to equalize timing.
    const passwordOk = verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { id: user.id, email: user.email, name: user.name, timezone: user.timezone };
  }
}

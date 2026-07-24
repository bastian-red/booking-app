import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@booking/db';
import type { LoginInput, SignupInput } from '@booking/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';

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
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { id: user.id, email: user.email, name: user.name, timezone: user.timezone };
  }
}

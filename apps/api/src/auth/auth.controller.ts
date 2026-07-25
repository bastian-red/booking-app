import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type SafeUser } from './auth.service';

/** Requests per minute per IP allowed on the credential endpoints. */
const AUTH_RATE_LIMIT = { default: { limit: 5, ttl: 60_000 } };

/** Public auth endpoints consumed by the web app's Auth.js layer. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tighter than the global 60/min: signup and login are the brute-force and
  // account-spam surface, so cap them at 5/min per IP.
  @Throttle(AUTH_RATE_LIMIT)
  @Post('signup')
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<SafeUser> {
    return this.auth.signup(body);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<SafeUser> {
    return this.auth.login(body);
  }
}

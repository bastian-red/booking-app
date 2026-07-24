import { Body, Controller, Post } from '@nestjs/common';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type SafeUser } from './auth.service';

/** Public auth endpoints consumed by the web app's Auth.js layer. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<SafeUser> {
    return this.auth.signup(body);
  }

  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<SafeUser> {
    return this.auth.login(body);
  }
}

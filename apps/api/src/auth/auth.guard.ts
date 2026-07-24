import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { CONFIG, type AppConfig } from '../config/config';

export interface HostTokenPayload {
  /** Host user id. */
  sub: string;
  email: string;
}

export interface AuthedRequest extends Request {
  hostId: string;
  hostEmail: string;
}

/**
 * Verifies the HS256 service token minted by the web app (signed with the shared
 * AUTH_SECRET) and attaches the host id to the request. The web app holds the
 * Auth.js session; it mints this short-lived token when calling the API.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = jwt.verify(token, this.config.authSecret, {
        algorithms: ['HS256'],
      }) as HostTokenPayload;
      if (!payload.sub) throw new Error('no subject');
      req.hostId = payload.sub;
      req.hostEmail = payload.email;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

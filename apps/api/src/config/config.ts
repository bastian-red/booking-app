import { paymentsConfigFromEnv, type PaymentsConfig } from '@booking/payments';
import { smtpConfigFromEnv, type SmtpConfig } from '@booking/notifications';

export interface AppConfig {
  port: number;
  redisUrl: string;
  authSecret: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  reminderLeadMinutes: number;
  pendingExpiryMinutes: number;
  payments: PaymentsConfig;
  smtp: SmtpConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const authSecret = env.AUTH_SECRET;
  if (!authSecret || authSecret.length < 16) {
    throw new Error('AUTH_SECRET must be set (>= 16 chars).');
  }
  return {
    port: Number(env.API_PORT ?? '4000'),
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    authSecret,
    appBaseUrl: env.APP_BASE_URL ?? 'http://localhost:3000',
    apiBaseUrl: env.API_BASE_URL ?? 'http://localhost:4000',
    reminderLeadMinutes: Number(env.REMINDER_LEAD_MINUTES ?? '1440'),
    pendingExpiryMinutes: Number(env.PENDING_EXPIRY_MINUTES ?? '15'),
    payments: paymentsConfigFromEnv(env),
    smtp: smtpConfigFromEnv(env),
  };
}

export const CONFIG = Symbol('APP_CONFIG');

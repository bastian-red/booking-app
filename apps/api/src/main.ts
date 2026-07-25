import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfig } from './config/config';

async function bootstrap(): Promise<void> {
  // rawBody:true exposes req.rawBody so the Stripe webhook can verify signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = loadConfig();

  // Behind Railway's proxy the socket IP is the proxy, not the client. Trust the
  // first proxy hop so req.ip is the real client address the rate limiter keys on.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Request validation is done with Zod contracts (packages/shared) inside the
  // controllers, so there is no Nest ValidationPipe / class-validator here.
  app.enableCors({ origin: config.appBaseUrl, credentials: true });
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`API listening on :${config.port}`, 'Bootstrap');
}

void bootstrap();

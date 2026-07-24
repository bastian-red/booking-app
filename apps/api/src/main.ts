import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfig } from './config/config';

async function bootstrap(): Promise<void> {
  // rawBody:true exposes req.rawBody so the Stripe webhook can verify signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = loadConfig();

  app.enableCors({ origin: config.appBaseUrl, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`API listening on :${config.port}`, 'Bootstrap');
}

void bootstrap();

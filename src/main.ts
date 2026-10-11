import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.enableCors({
  origin: 'http://localhost:5173',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

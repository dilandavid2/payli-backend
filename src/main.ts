import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { crearOpcionesCors } from './configuracion/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const opcionesCors = crearOpcionesCors(
    process.env.NODE_ENV,
    process.env.CORS_ORIGINS,
  );

  if (opcionesCors !== null) {
    app.enableCors(opcionesCors);
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();

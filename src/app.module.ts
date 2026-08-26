import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasasModule } from './tasas/tasas.module';
import { HealthController } from './health.controller';
import { EncuestasModule } from './encuestas/encuestas.module';

@Module({
  imports: [TasasModule, EncuestasModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

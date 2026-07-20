import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasasModule } from './tasas/tasas.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TasasModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

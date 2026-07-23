import { Module } from '@nestjs/common';
import { TasasController } from './tasas.controller';
import { TasasService } from './tasas.service';
import { HistorialTasasRepository } from './historial-tasas.repository';

@Module({
  controllers: [TasasController],
  providers: [TasasService, HistorialTasasRepository],
})
export class TasasModule {}

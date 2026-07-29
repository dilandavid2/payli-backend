import { Module } from '@nestjs/common';
import { TasasController } from './tasas.controller';
import { TasasService } from './tasas.service';
import { HistorialTasasRepository } from './historial-tasas.repository';
import { BinanceService } from './binance.service';

@Module({
  controllers: [TasasController],
  providers: [TasasService, BinanceService, HistorialTasasRepository],
})
export class TasasModule {}
